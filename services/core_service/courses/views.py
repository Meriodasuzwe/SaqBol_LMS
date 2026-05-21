import stripe
import json
import requests
import random
import string
import uuid

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from django.core.files.storage import default_storage
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from notifications.service import send_notification
from rest_framework.permissions import AllowAny, IsAdminUser
from django.core.mail import send_mail

from .models import Category, Course, Enrollment, Lesson, LessonStep, StepProgress, Review, Certificate, B2BLead, CorporateInvite
from .serializers import CategorySerializer, CourseSerializer, LessonSerializer, LessonStepSerializer, ReviewSerializer, CertificateSerializer, B2BLeadSerializer
from quizzes.models import Quiz, Result
from .certificate_generator import generate_certificate_image
from rest_framework.throttling import AnonRateThrottle

User = get_user_model()
stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)

# 🔥 КАСТОМНЫЙ ПЕРМИШЕН ДЛЯ РЕАЛЬНЫХ АДМИНОВ 🔥
# Он гарантирует, что обычный учитель со статусом "is_staff" не получит права модератора
class IsActualAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (getattr(request.user, 'role', '') == 'admin' or request.user.is_superuser))


class CategoryListView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CourseListView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Course.objects.filter(status='published')
        
        search_query = self.request.query_params.get('search', None)
        category_id = self.request.query_params.get('category', None)

        if search_query:
            queryset = queryset.filter(title__icontains=search_query)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)


class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_object(self):
        course = super().get_object()
        
        is_admin = self.request.user.is_authenticated and (getattr(self.request.user, 'role', '') == 'admin' or self.request.user.is_superuser)

        if self.request.method in permissions.SAFE_METHODS:
            if course.status != 'published':
                if not self.request.user.is_authenticated or (course.teacher != self.request.user and not is_admin):
                    raise PermissionDenied("Этот курс скрыт или находится на модерации.")
            return course

        if course.teacher != self.request.user and not is_admin:
            raise PermissionDenied("Только преподаватель может редактировать этот курс.")
        return course


class EnrollCourseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        is_admin = request.user.role == 'admin' or request.user.is_superuser
        
        if course.status != 'published' and course.teacher != request.user and not is_admin:
            raise PermissionDenied("Нельзя записаться на неопубликованный курс.")

        if course.price > 0:
            return Response(
                {"error": "Этот курс платный. Пожалуйста, оплатите его перед записью."}, 
                status=status.HTTP_402_PAYMENT_REQUIRED
            )

        enrollment, created = Enrollment.objects.get_or_create(student=request.user, course=course)
        
        if created:
            return Response({"message": "Вы успешно записались!"}, status=status.HTTP_201_CREATED)
        else:
            return Response({"message": "Вы уже записаны на этот курс"}, status=status.HTTP_200_OK)


class CreateStripeCheckoutSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        is_admin = request.user.role == 'admin' or request.user.is_superuser
        
        if course.status != 'published' and course.teacher != request.user and not is_admin:
            raise PermissionDenied("Курс недоступен для покупки.")

        if course.price <= 0:
            return Response({"error": "Этот курс бесплатный!"}, status=status.HTTP_400_BAD_REQUEST)

        price_in_cents = int(course.price * 100)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost')

        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[
                    {
                        'price_data': {
                            'currency': 'kzt',
                            'unit_amount': price_in_cents,
                            'product_data': {
                                'name': course.title,
                                'description': course.short_description or 'Обучающий курс',
                            },
                        },
                        'quantity': 1,
                    },
                ],
                mode='payment',
                success_url=f"{frontend_url}/course/{course.id}?success=true",
                cancel_url=f"{frontend_url}/course/{course.id}?canceled=true",
                metadata={
                    'course_id': course.id,
                    'user_id': request.user.id
                }
            )
            return Response({'checkout_url': checkout_session.url})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LessonListCreateView(generics.ListCreateAPIView):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        course_id = self.kwargs.get('course_id')
        return Lesson.objects.filter(course_id=course_id).order_by('order')

    def perform_create(self, serializer):
        course = get_object_or_404(Course, id=self.kwargs.get('course_id'))
        is_admin = self.request.user.role == 'admin' or self.request.user.is_superuser
        
        if course.teacher != self.request.user and not is_admin:
            raise PermissionDenied("Вы не являетесь автором этого курса.")
            
        serializer.save(course=course)


class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        lesson = super().get_object()
        course = lesson.course
        user = self.request.user

        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        is_teacher = (course.teacher == user)
        is_admin = user.role == 'admin' or user.is_superuser

        if self.request.method in permissions.SAFE_METHODS:
            if not (is_enrolled or is_teacher or is_admin):
                raise PermissionDenied("Доступ к уроку запрещен. Запишитесь на курс.")
        else:
            if not is_teacher and not is_admin:
                raise PermissionDenied("Редактировать урок может только автор.")
        return lesson


class LessonStepCreateView(generics.CreateAPIView):
    serializer_class = LessonStepSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        lesson = get_object_or_404(Lesson, id=self.kwargs['lesson_id'])
        is_admin = self.request.user.role == 'admin' or self.request.user.is_superuser

        if lesson.course.teacher != self.request.user and not is_admin:
            raise PermissionDenied("Только преподаватель может добавлять шаги.")
        serializer.save(lesson=lesson)


class LessonStepDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LessonStep.objects.all()
    serializer_class = LessonStepSerializer
    permission_classes = [permissions.IsAuthenticated]

    # 🔥 Здесь был скрытый баг. Мы убрали сломанный get_queryset и перенесли логику в get_object
    def get_object(self):
        step = super().get_object()
        course = step.lesson.course
        user = self.request.user

        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        is_teacher = (course.teacher == user)
        is_admin = user.role == 'admin' or user.is_superuser

        if self.request.method in permissions.SAFE_METHODS:
            if not (is_enrolled or is_teacher or is_admin):
                raise PermissionDenied("Доступ к шагу запрещен. Запишитесь на курс.")
        else:
            if not is_teacher and not is_admin:
                raise PermissionDenied("Редактировать шаг может только автор.")
        return step


class MyCoursesView(generics.ListAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        request_type = self.request.query_params.get('type')

        # 1. Если фронтенд запрашивает курсы, которые юзер ПРЕПОДАЕТ
        if request_type == 'teaching':
            if getattr(user, 'role', '') in ['teacher', 'admin'] or user.is_superuser:
                return Course.objects.filter(teacher=user)
            return Course.objects.none()
        
        # 2. ПО УМОЛЧАНИЮ отдаем курсы, которые юзер КУПИЛ (Изучает)
        enrolled_course_ids = Enrollment.objects.filter(student=user).values_list('course_id', flat=True)
        return Course.objects.filter(id__in=enrolled_course_ids)


class MarkStepCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        step = get_object_or_404(LessonStep, pk=pk)
        user = request.user
        score = request.data.get('score', 10)
        is_admin = user.role == 'admin' or user.is_superuser

        if step.step_type == 'quiz' and not (step.lesson.course.teacher == user or is_admin):
            quizzes = Quiz.objects.filter(lesson=step.lesson)
            if quizzes.exists():
                passed = Result.objects.filter(student=user, quiz__in=quizzes, score__gte=70).exists()
                if not passed:
                    return Response(
                        {"error": "Сначала нужно успешно пройти тесты для этого урока (минимум 70%)."}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

        progress, created = StepProgress.objects.update_or_create(
            student=user,
            step=step,
            defaults={'score_earned': score, 'is_completed': True}
        )

        course = step.lesson.course
        total_steps = LessonStep.objects.filter(lesson__course=course).count()
        completed_steps = StepProgress.objects.filter(
            student=user, 
            step__lesson__course=course, 
            is_completed=True
        ).count()

        just_completed = False 

        if total_steps > 0 and completed_steps >= total_steps:
            if not Certificate.objects.filter(student=user, course=course).exists():
                new_cert = Certificate.objects.create(student=user, course=course)
                generate_certificate_image(new_cert)
                
                send_notification(
                    recipient=user,
                    notification_type='certificate_issued',
                    title='🎉 Сертификат получен!',
                    message=f'Поздравляем! Вы успешно завершили курс «{course.title}».'
                )
                just_completed = True

        return Response({
            "message": "Шаг пройден!", 
            "score_earned": score,
            "just_completed": just_completed
        }, status=status.HTTP_200_OK)


class BulkCreateCourseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        title = data.get('course_title')
        description = data.get('course_description', '')
        lessons_data = data.get('lessons', [])

        if not title:
            return Response({'error': 'Название курса обязательно'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            category = Category.objects.first()
            if not category:
                category = Category.objects.create(title="Сгенерированные AI")

            course = Course.objects.create(
                title=title, 
                description=description,
                teacher=request.user,
                category=category,
                status='draft'
            )

            for i, lesson_data in enumerate(lessons_data):
                lesson = Lesson.objects.create(
                    course=course,
                    title=lesson_data.get('title', 'Без названия'),
                    order=i + 1
                )
                
                LessonStep.objects.create(
                    lesson=lesson,
                    step_type='text',
                    content=lesson_data.get('content', ''),
                    order=1
                )

            return Response({
                'message': 'Курс успешно создан!', 
                'course_id': course.id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"🔥 ОШИБКА СОХРАНЕНИЯ В БД: {str(e)}") 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@csrf_exempt
def stripe_webhook(request):
    import stripe
    import traceback
    from django.http import HttpResponse
    from django.contrib.auth import get_user_model
    from .models import Course, Enrollment 

    print("\n" + "="*40, flush=True)
    print("🔥 СТРАЙП СТУЧИТСЯ В ВЕБХУК!", flush=True)

    try:
        webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)
        if not webhook_secret:
            print("❌ ОШИБКА: STRIPE_WEBHOOK_SECRET пустой в settings.py!", flush=True)
            return HttpResponse("No secret", status=500)

        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        print(f"✅ Успешно принято событие: {event['type']}", flush=True)

        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            
            metadata = getattr(session, 'metadata', None)
            
            if metadata:
                course_id = getattr(metadata, 'course_id', None)
                user_id = getattr(metadata, 'user_id', None)
            else:
                course_id, user_id = None, None

            if course_id and user_id:
                User = get_user_model()
                course = Course.objects.get(id=course_id)
                user = User.objects.get(id=user_id)
                
                Enrollment.objects.get_or_create(student=user, course=course)
                print(f"🎉 УРА! Пользователь {user.email} записан на курс!", flush=True)
            else:
                print("⚠️ ВНИМАНИЕ: В metadata не оказалось course_id или user_id", flush=True)

        print("="*40 + "\n", flush=True)
        return HttpResponse(status=200)

    except Exception as e:
        print("❌ КРИТИЧЕСКАЯ ОШИБКА В ВЕБХУКЕ:", flush=True)
        traceback.print_exc()
        return HttpResponse(status=500)


@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_image(request):
    if 'file' not in request.FILES:
        return Response({'error': 'Файл не найден'}, status=400)

    file = request.FILES['file']
    ext = file.name.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    
    saved_path = default_storage.save(f'course_images/{filename}', file)
    file_url = request.build_absolute_uri(default_storage.url(saved_path))
    
    return Response({'url': file_url})


# ---------------------------
# Админ-панель: Модерация курсов (Защищено кастомным пермишеном!)
# ---------------------------
class PendingCoursesView(generics.ListAPIView):
    permission_classes = [IsActualAdminRole]
    serializer_class = CourseSerializer

    def get_queryset(self):
        return Course.objects.filter(status='draft')

class ApproveCourseView(generics.UpdateAPIView):
    permission_classes = [IsActualAdminRole]
    queryset = Course.objects.all()
 
    def patch(self, request, *args, **kwargs):
        course = self.get_object()
        course.status = 'published'
        course.save()
 
        send_notification(
            recipient=course.teacher,
            notification_type='course_approved',
            title='Курс опубликован',
            message=(
                f'Ваш курс «{course.title}» прошёл модерацию и теперь '
                f'доступен всем студентам в каталоге. Поздравляем!'
            ),
        )
        return Response({"message": "Курс успешно опубликован!"})
 
 
class RejectCourseView(generics.UpdateAPIView):
    permission_classes = [IsActualAdminRole]
    queryset = Course.objects.all()
 
    def patch(self, request, *args, **kwargs):
        course = self.get_object()
        reason = request.data.get('rejection_reason', 'Причина не указана')
 
        course.status = 'rejected'
        course.save()
 
        send_notification(
            recipient=course.teacher,
            notification_type='course_rejected',
            title='Курс отклонён',
            message=(
                f'К сожалению, ваш курс «{course.title}» не прошёл модерацию.\n\n'
                f'Причина: {reason}\n\n'
                f'Вы можете внести исправления и отправить курс на повторную проверку.'
            ),
        )
        return Response({"message": "Курс отклонен, уведомление отправлено."})


class ReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Review.objects.filter(course_id=self.kwargs['course_id'])

    def perform_create(self, serializer):
        course_id = self.kwargs['course_id']
        user = self.request.user
        
        course = get_object_or_404(Course, id=course_id)
        
        is_admin = user.role == 'admin' or user.is_superuser
        is_author_or_admin = (course.teacher == user) or is_admin
        
        if not is_author_or_admin and not Enrollment.objects.filter(course_id=course_id, student=user).exists():
            raise ValidationError(["Вы не можете оставить отзыв, так как не записаны на этот курс."])
            
        if Review.objects.filter(course_id=course_id, user=user).exists():
            raise ValidationError(["Вы уже оставляли отзыв на этот курс."])
            
        if not is_author_or_admin:
            steps = LessonStep.objects.filter(lesson__course_id=course_id)
            total_steps = steps.count()
            
            if total_steps > 0:
                completed_count = 0
                for step in steps:
                    if step.step_type == 'quiz':
                        quizzes = Quiz.objects.filter(lesson=step.lesson)
                        if quizzes.exists() and Result.objects.filter(student=user, quiz__in=quizzes, score__gte=70).exists():
                            completed_count += 1
                    else:
                        if StepProgress.objects.filter(student=user, step=step, is_completed=True).exists():
                            completed_count += 1
                
                progress = (completed_count / total_steps) * 100
                if progress < 20:
                    raise ValidationError([f"Вы прошли только {int(progress)}%. Для отзыва необходимо пройти минимум 20% курса."])
        
        serializer.save(user=user, course=course)
        

class ReviewDeleteView(generics.DestroyAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        review = super().get_object()
        is_admin = self.request.user.role == 'admin' or self.request.user.is_superuser
        if review.user != self.request.user and not is_admin:
            raise PermissionDenied("Вы не можете удалить чужой отзыв.")
        return review


class MyCertificatesView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CertificateSerializer

    def get_queryset(self):
        return Certificate.objects.filter(
            student=self.request.user, 
            is_valid=True
        ).order_by('-issued_at')


class VerifyCertificateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, cert_id):
        cert = get_object_or_404(Certificate, id=cert_id, is_valid=True)
        return Response({
            "valid": True,
            "id": cert.id,
            "course_title": cert.course.title,
            "student_name": f"{cert.student.first_name} {cert.student.last_name}".strip() or cert.student.username,
            "issued_at": cert.issued_at,
            "file_url": request.build_absolute_uri(cert.file.url) if cert.file else None
        })


class ChangeCertificateLanguageView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, cert_id):
        language = request.data.get('language', 'ru')
        cert = get_object_or_404(Certificate, id=cert_id, is_valid=True)
        generate_certificate_image(cert, language=language)
        
        return Response({
            "message": "Язык сертификата обновлен",
            "file_url": request.build_absolute_uri(cert.file.url)
        })


class ChatReplyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        step = get_object_or_404(LessonStep, pk=pk)
        user_message = request.data.get('message')
        history = request.data.get('history', [])

        scenario = step.scenario_data or {}
        if isinstance(scenario, str):
            try:
                scenario = json.loads(scenario)
            except json.JSONDecodeError:
                scenario = {}
        
        contact_name = scenario.get('contact_name', 'Служба безопасности')

        payload = {
            "message": user_message,
            "history": history,
            "contact_name": contact_name,
            "language": "Русский",
            "scenario_rules": scenario
        }

        try:
            ai_service_url = getattr(settings, 'AI_SERVICE_URL', 'http://ai_service:8000') 
            endpoint_url = f"{ai_service_url}/generate-scenario/chat-reply"
            
            response = requests.post(endpoint_url, json=payload, timeout=30)
            
            if not response.ok:
                return Response({"error": f"FastAPI вернул ошибку: {response.text}"}, status=500)
            
            return Response(response.json())
            
        except requests.exceptions.RequestException as e:
            return Response({"error": "Сервер ИИ временно недоступен"}, status=500)
        

class B2BLeadThrottle(AnonRateThrottle):
    scope = 'b2b_leads'
    def get_ident(self, request):
        # Достаем реальный IP-адрес, даже если мы за Nginx / Docker
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            # Если запрос прошел через цепочку прокси, берем самый первый (реальный IP клиента)
            return xff.split(',')[0].strip()
        # Если прокси нет, берем стандартный IP
        return super().get_ident(request)


class B2BLeadCreateView(generics.CreateAPIView):
    queryset = B2BLead.objects.all()
    serializer_class = B2BLeadSerializer
    permission_classes = [AllowAny]
    throttle_classes = [B2BLeadThrottle] 

    def perform_create(self, serializer):
        lead = serializer.save()

        course_name = lead.target_course.title if lead.target_course else "нашу платформу"
        
        subject = f'Заявка на корпоративное обучение: {course_name}'
        message = (
            f'Здравствуйте, {lead.name}!\n\n'
            f'Мы успешно получили вашу заявку на обучение сотрудников компании "{lead.company}".\n'
            f'Наш менеджер уже изучает информацию и свяжется с вами в ближайшее время, '
            f'чтобы обсудить детали и открыть демо-доступ.\n\n'
            f'С уважением,\n'
            f'Команда поддержки SaqBol LMS.'
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@saqbol.kz'), 
                recipient_list=[lead.email],
                fail_silently=True,
            )
            print(f"✅ УСПЕШНО: Письмо-автоответчик отправлено клиенту {lead.email}")
        except Exception as e:
            print(f"❌ ОШИБКА ОТПРАВКИ ПИСЬМА: {e}")

class B2BLeadListView(generics.ListAPIView):
    queryset = B2BLead.objects.all().order_by('-created_at')
    serializer_class = B2BLeadSerializer
    permission_classes = [IsActualAdminRole]

class B2BLeadUpdateView(generics.UpdateAPIView): 
    queryset = B2BLead.objects.all()
    serializer_class = B2BLeadSerializer
    permission_classes = [IsActualAdminRole]

class B2BLeadDeleteView(generics.DestroyAPIView):
    queryset = B2BLead.objects.all()
    permission_classes = [IsActualAdminRole]
    
def generate_smart_code(company_name, course_title):
    clean_company = ''.join(e for e in company_name if e.isalnum()).upper()[:8]
    clean_course = ''.join(e for e in course_title if e.isalnum()).upper()[:4]
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{clean_company}-{clean_course}-{random_str}"


class ActivateInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated] 
    
    def post(self, request, course_id):
        code = request.data.get('code')
        if not code:
            return Response({"error": "Пожалуйста, введите код"}, status=status.HTTP_400_BAD_REQUEST)

        invite = CorporateInvite.objects.filter(code=code.upper(), course_id=course_id, is_active=True).first()

        if not invite:
            return Response({"error": "Неверный код или он не подходит к этому курсу"}, status=status.HTTP_404_NOT_FOUND)

        if invite.used_count >= invite.max_uses:
            return Response({"error": "Лимит использований этого корпоративного кода исчерпан"}, status=status.HTTP_400_BAD_REQUEST)

        enrollment, created = Enrollment.objects.get_or_create(student=request.user, course=invite.course)
        invite.activated_by.add(request.user)
        
        if not created:
            return Response({"message": "Вы уже записаны на этот курс!"}, status=status.HTTP_200_OK)

        invite.used_count += 1
        
        if invite.used_count >= invite.max_uses:
            invite.is_active = False 
            
        invite.save()

        return Response({"message": "Код успешно активирован! Доступ к курсу открыт 🎉"}, status=status.HTTP_200_OK)


class GenerateCorporateInviteView(APIView):
    permission_classes = [IsActualAdminRole] 
    
    def post(self, request, lead_id):
        lead = get_object_or_404(B2BLead, id=lead_id)
        
        if not lead.target_course:
            return Response({"error": "У заявки не выбран целевой курс. Код сгенерировать нельзя."}, status=status.HTTP_400_BAD_REQUEST)

        existing_invite = CorporateInvite.objects.filter(lead=lead).first()
        if existing_invite:
            return Response({"code": existing_invite.code, "message": "Код уже был сгенерирован ранее."})

        code = generate_smart_code(lead.company, lead.target_course.title)
        
        max_uses = 50 
        if '-' in lead.employees:
            try:
                max_uses = int(lead.employees.split('-')[1])
            except:
                pass

        invite = CorporateInvite.objects.create(
            code=code,
            course=lead.target_course,
            lead=lead,
            max_uses=max_uses
        )

        lead.status = 'closed'
        lead.save()

        manager_user = User.objects.filter(email=lead.email).first()
        created_new_user = False
        raw_password = None

        if not manager_user:
            raw_password = User.objects.make_random_password(length=8)
            manager_user = User.objects.create_user(
                username=lead.email.split('@')[0] + str(random.randint(10, 99)),
                email=lead.email,
                password=raw_password,
                first_name=lead.name,
                role='student'
            )
            created_new_user = True

        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://saqbol.asia')
        
        subject = f'Ваш корпоративный доступ к курсу "{lead.target_course.title}"'
        
        if created_new_user:
            auth_info = (
                f"Мы создали для вас личный кабинет руководителя.\n"
                f"Логин (email): {lead.email}\n"
                f"Пароль: {raw_password}\n"
                f"Войти на платформу: {frontend_url}/login\n"
            )
        else:
            auth_info = (
                f"Для доступа к дашборду руководителя используйте ваш текущий аккаунт "
                f"на платформе ({lead.email}).\n"
                f"Войти на платформу: {frontend_url}/login\n"
            )

        message = (
            f"Здравствуйте, {lead.name}!\n\n"
            f"Оплата успешно получена. Корпоративный доступ для компании «{lead.company}» открыт.\n\n"
            f"--- ИНСТРУКЦИЯ ДЛЯ ВАШИХ СОТРУДНИКОВ ---\n"
            f"Передайте этот код вашей команде: {code}\n"
            f"Количество доступных мест: {max_uses}\n"
            f"Сотрудники должны зарегистрироваться на сайте и ввести этот код на странице курса.\n\n"
            f"--- ВАШ КАБИНЕТ РУКОВОДИТЕЛЯ ---\n"
            f"{auth_info}\n"
            f"Там вы сможете следить за прогрессом ваших сотрудников.\n\n"
            f"Спасибо, что выбрали нас!\n"
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, 'EMAIL_HOST_USER', 'noreply@test.com'),
                recipient_list=[lead.email],
                fail_silently=False,
            )
            print(f"📧 Письмо с доступами успешно отправлено на {lead.email}")
        except Exception as e:
            print(f"❌ ОШИБКА ОТПРАВКИ ПИСЬМА: {e}")

        return Response({"code": invite.code, "message": "Код создан и доступы отправлены на почту клиента!"})


class B2BDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        leads = B2BLead.objects.filter(email=user.email).order_by('-created_at')

        if not leads.exists():
            return Response({"message": "У вас пока нет активных корпоративных курсов."}, status=200)

        dashboard_data = []

        for lead in leads:
            lead_data = {
                "id": lead.id,
                "company": lead.company,
                "status": lead.status,
                "created_at": lead.created_at,
                "course_title": lead.target_course.title if lead.target_course else "Не выбран",
                "invite_code": None,
                "total_places": None,
                "used_places": None,
                "employees": []
            }

            invite = CorporateInvite.objects.filter(lead=lead).first()
            
            if invite:
                lead_data["invite_code"] = invite.code
                lead_data["total_places"] = invite.max_uses
                lead_data["used_places"] = invite.used_count
                
                course = invite.course
                total_steps = LessonStep.objects.filter(lesson__course=course).count()

                for student in invite.activated_by.all():
                    progress_percent = 0
                    
                    if total_steps > 0:
                        completed_steps = StepProgress.objects.filter(
                            student=student,
                            step__lesson__course=course,
                            is_completed=True
                        ).count()
                        progress_percent = int((completed_steps / total_steps) * 100)

                    if progress_percent == 100:
                        status_text = "Завершен"
                        color = "emerald"
                    elif progress_percent > 0:
                        status_text = "В процессе"
                        color = "blue"
                    else:
                        status_text = "Не начал"
                        color = "red"

                    quiz_results = Result.objects.filter(
                        student=student,
                        quiz__lesson__course=course
                    ).order_by('-completed_at')

                    tests_data = []
                    for res in quiz_results:
                        tests_data.append({
                            "id": res.id,
                            "title": res.quiz.title if res.quiz.title else "Тест",
                            "score": res.score,
                            "passed": res.score >= 70,
                            "date": res.completed_at.strftime('%d.%m.%Y') if res.completed_at else ""
                        })

                    lead_data["employees"].append({
                        "id": student.id,
                        "name": f"{student.first_name} {student.last_name}".strip() or student.username,
                        "email": student.email,
                        "progress": progress_percent,
                        "status": status_text,
                        "color": color,
                        "tests": tests_data
                    })

            dashboard_data.append(lead_data)

        return Response(dashboard_data)


class RevokeEmployeeAccessView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, invite_code, user_id):
        invite = get_object_or_404(CorporateInvite, code=invite_code, lead__email=request.user.email)
        
        User = get_user_model()
        student = get_object_or_404(User, id=user_id)

        if student in invite.activated_by.all():
            invite.activated_by.remove(student)
            
            if invite.used_count > 0:
                invite.used_count -= 1
            invite.save()

            Enrollment.objects.filter(student=student, course=invite.course).delete()

            return Response({"message": "Доступ успешно отозван, место освобождено."})
        
        return Response({"error": "Этот сотрудник не использует данный код."}, status=400)


@api_view(['GET'])
def promo_slots(request):
    total = 100
    used = B2BLead.objects.count()  
    remaining = max(0, total - used)
    return Response({'remaining': remaining})