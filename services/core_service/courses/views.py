import stripe
from django.conf import settings
from django.http import HttpResponse # Добавлен импорт для вебхука
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from django.core.files.storage import default_storage
import uuid
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

User = get_user_model()

# Импорты моделей и сериализаторов
from .models import Category, Course, Enrollment, Lesson, LessonStep, StepProgress
from .serializers import CategorySerializer, CourseSerializer, LessonSerializer, LessonStepSerializer
from quizzes.models import Quiz, Result

# Инициализация ключа Stripe
stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)


class CategoryListView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CourseListView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Course.objects.all()
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
        if self.request.method in permissions.SAFE_METHODS:
            return course

        if course.teacher != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Только преподаватель может редактировать этот курс.")
        return course


class EnrollCourseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        
        # Если курс платный, требуем оплаты через Stripe (не даем записаться бесплатно)
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


# --- STRIPE ОПЛАТА ---
class CreateStripeCheckoutSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, course_id):
        course = get_object_or_404(Course, id=course_id)
        
        if course.price <= 0:
            return Response({"error": "Этот курс бесплатный!"}, status=status.HTTP_400_BAD_REQUEST)

        # Переводим в минимальные единицы (тиын/центы)
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
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        course_id = self.kwargs.get('course_id')
        course = get_object_or_404(Course, id=course_id)
        user = self.request.user

        if course.teacher == user or user.is_staff:
            return Lesson.objects.filter(course_id=course_id).order_by('order')

        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        if not is_enrolled:
            raise PermissionDenied("Вы не записаны на этот курс. Сначала запишитесь.")

        return Lesson.objects.filter(course_id=course_id).order_by('order')

    def perform_create(self, serializer):
        course = get_object_or_404(Course, id=self.kwargs.get('course_id'))
        if course.teacher != self.request.user and not self.request.user.is_staff:
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

        if self.request.method in permissions.SAFE_METHODS:
            if not (is_enrolled or is_teacher or user.is_staff):
                raise PermissionDenied("Доступ к уроку запрещен. Запишитесь на курс.")
        else:
            if not is_teacher and not user.is_staff:
                raise PermissionDenied("Редактировать урок может только автор.")
        return lesson


class LessonStepCreateView(generics.CreateAPIView):
    serializer_class = LessonStepSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        lesson = get_object_or_404(Lesson, id=self.kwargs['lesson_id'])
        if lesson.course.teacher != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Только преподаватель может добавлять шаги.")
        serializer.save(lesson=lesson)


class LessonStepDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LessonStep.objects.all()
    serializer_class = LessonStepSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return LessonStep.objects.all()
        return LessonStep.objects.filter(lesson__course__teacher=self.request.user)


class MyCoursesView(generics.ListAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['teacher', 'admin'] or user.is_staff:
            return Course.objects.filter(teacher=user)
        
        enrolled_course_ids = Enrollment.objects.filter(student=user).values_list('course_id', flat=True)
        return Course.objects.filter(id__in=enrolled_course_ids)


class MarkStepCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        step = get_object_or_404(LessonStep, pk=pk)
        user = request.user
        score = request.data.get('score', 10)

        if not (step.lesson.course.teacher == user or user.is_staff):
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

        return Response({"message": "Шаг пройден!", "score_earned": score}, status=status.HTTP_200_OK)


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
                category=category 
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


# --- STRIPE WEBHOOK (ОБНОВЛЕННЫЙ: ТЕПЕРЬ ЭТО ФУНКЦИЯ) ---
@csrf_exempt
def stripe_webhook(request):
    import sys
    print("\n" + "="*40, flush=True)
    print("🔥 СТРАЙП СТУЧИТСЯ В ВЕБХУК!", flush=True)

    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)
    
    if not webhook_secret:
        print("❌ ОШИБКА: STRIPE_WEBHOOK_SECRET пустой в settings.py!", flush=True)
        return HttpResponse("No secret", status=500)

    try:
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        print(f"✅ Успешно принято событие: {event['type']}", flush=True)
        
    except Exception as e:
        print(f"❌ ОШИБКА ПОДПИСИ ИЛИ ПАРСИНГА: {str(e)}", flush=True)
        return HttpResponse(status=400)

    # Если оплата прошла успешно
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        course_id = session.get('metadata', {}).get('course_id')
        user_id = session.get('metadata', {}).get('user_id')
        
        print(f"🔍 Метаданные: Курс={course_id}, Юзер={user_id}", flush=True)

        if course_id and user_id:
            try:
                from .models import Course, Enrollment
                from django.contrib.auth import get_user_model
                User = get_user_model()
                
                course = Course.objects.get(id=course_id)
                user = User.objects.get(id=user_id)
                
                # Записываем на курс
                Enrollment.objects.get_or_create(student=user, course=course)
                print(f"🎉 УРА! Пользователь {user.email} записан на курс!", flush=True)
            except Exception as e:
                print(f"❌ ОШИБКА БАЗЫ ДАННЫХ: {str(e)}", flush=True)
                import traceback
                traceback.print_exc()
                return HttpResponse(status=500)

    print("="*40 + "\n", flush=True)
    return HttpResponse(status=200)


@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_image(request):
    if 'file' not in request.FILES:
        return Response({'error': 'Файл не найден'}, status=400)

    file = request.FILES['file']
    # Генерируем уникальное имя, чтобы файлы с одинаковыми названиями не перезаписывали друг друга
    ext = file.name.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    
    # Сохраняем файл
    saved_path = default_storage.save(f'course_images/{filename}', file)
    
    # Формируем полный URL (например, http://localhost:8000/media/course_images/123.jpg)
    file_url = request.build_absolute_uri(default_storage.url(saved_path))
    
    return Response({'url': file_url})