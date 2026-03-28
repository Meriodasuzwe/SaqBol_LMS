import logging
import uuid
import os
import hashlib
import hmac
import time
import random
from django.conf import settings
from django.core.mail import send_mail
from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta

from .models import EmailVerification
from .models import TeacherApplication
from .serializers import (
    RegisterSerializer, 
    UserSerializer,
    PasswordResetRequestSerializer, 
    SetNewPasswordSerializer,
    VerifyEmailSerializer,
    ResendVerificationSerializer,
    TeacherApplicationSerializer # <-- Добавили этот импорт
)

# Инициализируем логгер
logger = logging.getLogger(__name__)

# Получаем нашу модель User
User = get_user_model()


# ---------------------------
# Регистрация
# ---------------------------
class RegisterView(generics.CreateAPIView):
    queryset = RegisterSerializer.Meta.model.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "Пользователь успешно создан!",
                "username": user.username
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------
# Профиль (MeView)
# ---------------------------
class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    # Переопределяем этот метод, чтобы View знала, что "объект" — это текущий юзер из токена
    def get_object(self):
        return self.request.user


# ---------------------------
# Запрос на сброс пароля (Отправка Email)
# ---------------------------
class PasswordResetRequestView(generics.GenericAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Письмо отправляется внутри метода validate_email сериализатора
        return Response(
            {"message": "Если email существует, ссылка для сброса была отправлена."}, 
            status=status.HTTP_200_OK
        )


# ---------------------------
# Установка нового пароля (Прием нового пароля)
# ---------------------------
class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = SetNewPasswordSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Пароль успешно изменен."}, 
            status=status.HTTP_200_OK
        )


# ---------------------------
# Активация аккаунта по 6-значному коду
# ---------------------------
class VerifyEmailView(generics.GenericAPIView):
    serializer_class = VerifyEmailSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Берем пользователя и делаем его активным
        user = serializer.validated_data['user']
        user.is_active = True
        user.save()
        
        # Удаляем использованный код из базы для безопасности
        serializer.validated_data['verification'].delete()

        return Response(
            {"message": "Аккаунт успешно активирован! Теперь вы можете войти."}, 
            status=status.HTTP_200_OK
        )


# ---------------------------
# Повторная отправка кода подтверждения
# ---------------------------
class ResendVerificationView(generics.GenericAPIView):
    serializer_class = ResendVerificationSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']

        # Генерируем новый код (старый удалится автоматически в функции generate_code)
        verification = EmailVerification.generate_code(user)

        # Отправляем письмо с защитой от падения (try-except)
        try:
            send_mail(
                subject='Новый код подтверждения SaqBol LMS',
                message=f'Здравствуйте, {user.username}!\n\nВы запросили новый код подтверждения: {verification.code}\nКод действителен в течение 10 минут.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Ошибка отправки ПОВТОРНОГО email для {user.email}: {str(e)}")
            return Response(
                {"error": "Не удалось отправить письмо. Попробуйте позже."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {"message": "Новый код успешно отправлен."}, 
            status=status.HTTP_200_OK
        )

# ---------------------------
# Авторизация через Google (OAuth 2.0)
# ---------------------------
class GoogleLoginView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        token = request.data.get('credential')
        if not token:
            return Response({'error': 'Токен не предоставлен'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Наш Client ID из Google Cloud Console
            CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
            
            # Проверка подлинности токена через сервера Google
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), CLIENT_ID)

            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')

            # Ищем пользователя в нашей БД
            user = User.objects.filter(email=email).first()
            
            # Если такого юзера нет, тихо создаем его
            if not user:
                base_username = email.split('@')[0]
                username = base_username
                # Если такой username уже есть, добавляем случайные символы
                if User.objects.filter(username=username).exists():
                    username = f"{base_username}_{uuid.uuid4().hex[:5]}"

                user = User.objects.create(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role='student',
                    is_active=True # Аккаунты от Google считаются подтвержденными
                )
                user.set_unusable_password() # Блокируем вход по обычному паролю
                user.save()

            # Выдаем пользователю наши стандартные токены доступа к системе
            refresh = RefreshToken.for_user(user)

            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'username': user.username,
                'message': 'Успешный вход через Google'
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            logger.error(f"Ошибка проверки токена Google: {str(e)}")
            return Response({'error': 'Недействительный токен Google'}, status=status.HTTP_400_BAD_REQUEST)

# ---------------------------
# Обычный логин (по email/логину и паролю)
# ---------------------------
class CustomLoginView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = TokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        # Фронтенд может прислать как 'email', так и 'username' (в зависимости от инпута)
        login_data = request.data.get('email') or request.data.get('username')
        password = request.data.get('password')

        if not login_data or not password:
            return Response(
                {"error": "Пожалуйста, введите логин/email и пароль"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ищем пользователя либо по email, либо по username
        user = User.objects.filter(Q(email=login_data) | Q(username=login_data)).first()

        if not user:
            return Response(
                {"error": "Неверный логин, email или пароль"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        # ПРОВЕРКА НА GOOGLE: Если у юзера нет пароля в НАШЕЙ базе
        if not user.has_usable_password():
            return Response(
                {"error": "Вы регистрировались через Google или Telegram. Войдите через эти сервисы или восстановите пароль."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Проверяем пароль
        if not user.check_password(password):
            return Response(
                {"error": "Неверный логин, email или пароль"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Проверяем активацию
        if not user.is_active:
            return Response(
                {"error": "Аккаунт не активирован. Проверьте почту."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # Если всё ок, выдаем токены
        refresh = RefreshToken.for_user(user)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'username': user.username,
            'role': user.role
        }, status=status.HTTP_200_OK)

# ---------------------------
# Заявка на преподавателя
# ---------------------------
class ApplyTeacherView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # 1. Защита: вдруг он уже препод?
        if user.role in ['teacher', 'admin']:
            return Response({"error": "Вы уже являетесь автором курсов."}, status=400)
        
        # 2. Ищем заявку или создаем новую
        application, created = TeacherApplication.objects.get_or_create(user=user)
        
        # 3. Если заявка УЖЕ БЫЛА, проверяем статус
        if not created:
            if application.status == 'pending':
                return Response({"error": "Ваша заявка уже находится на рассмотрении."}, status=400)
            elif application.status == 'rejected':
                return Response({"error": "Ваша заявка была отклонена модератором."}, status=400)
            elif application.status == 'approved':
                return Response({"error": "Ваша заявка уже одобрена! Перезайдите в аккаунт."}, status=400)

        # === 4. САМОЕ ГЛАВНОЕ: СОХРАНЯЕМ ТЕКСТ ИЗ REACT В БАЗУ ===
        application.cv_text = request.data.get('cv_text', '')
        application.portfolio_url = request.data.get('portfolio_url', '')
        application.save()

        return Response({"message": "Заявка успешно отправлена! Ожидайте решения модератора."}, status=201)

# ---------------------------
# Авторизация через Telegram
# ---------------------------
class TelegramAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try: # 🔥 Обернули всё в try, чтобы ловить точную ошибку
            # Копируем QueryDict
            data = request.data.copy()
            
            # Возвращаем нормальное получение токена (можешь оставить жесткий, если хочешь)
            bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
            
            if not bot_token:
                return Response({"error": "TELEGRAM_BOT_TOKEN не настроен"}, status=500)
            
            # 1. Проверка подлинности данных
            if 'hash' not in data:
                return Response({"error": "Отсутствует hash Telegram"}, status=status.HTTP_400_BAD_REQUEST)

            tg_hash = data.pop('hash')
            if isinstance(tg_hash, list):
                tg_hash = tg_hash[0]
            
            data_check_list = []
            for key, value in data.items():
                val = value[0] if isinstance(value, list) else value
                if val is not None:
                    data_check_list.append(f"{key}={val}")
                    
            data_check_string = '\n'.join(sorted(data_check_list))

            secret_key = hashlib.sha256(bot_token.encode()).digest()
            expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

            if expected_hash != tg_hash:
                return Response({"error": "Данные подделаны или недействительны"}, status=status.HTTP_403_FORBIDDEN)

            # 2. Проверка устаревания
            auth_date_val = data.get('auth_date')
            auth_date = int(auth_date_val[0] if isinstance(auth_date_val, list) else auth_date_val or 0)
            
            if time.time() - auth_date > 86400:
                return Response({"error": "Данные авторизации устарели"}, status=status.HTTP_403_FORBIDDEN)

            # 3. Авторизация или Регистрация юзера
            tg_id_val = data.get('id')
            tg_id = str(tg_id_val[0] if isinstance(tg_id_val, list) else tg_id_val)
            
            first_name_val = data.get('first_name', '')
            first_name = first_name_val[0] if isinstance(first_name_val, list) else first_name_val
            
            last_name_val = data.get('last_name', '')
            last_name = last_name_val[0] if isinstance(last_name_val, list) else last_name_val
            
            username_val = data.get('username')
            username = username_val[0] if isinstance(username_val, list) else username_val
            if not username:
                username = f"tg_user_{tg_id}"

            # Ищем юзера по telegram_id
            user = User.objects.filter(telegram_id=tg_id).first()
            
            if not user:
                # 🔥 ИСПРАВЛЕНИЕ 1: Защита от дубликатов username (как в Google)
                import uuid
                if User.objects.filter(username=username).exists():
                    username = f"{username}_{uuid.uuid4().hex[:5]}"

                # 🔥 ИСПРАВЛЕНИЕ 2: Даем фейковый email, если база его требует
                fake_email = f"{tg_id}@telegram.com"
                
                user = User.objects.create_user(
                    username=username,
                    email=fake_email, 
                    first_name=first_name,
                    last_name=last_name,
                    
                )
                user.set_unusable_password()
                user.telegram_id = tg_id
                user.is_active = True 
                user.save()

            # 4. Выдаем JWT токены
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'role': getattr(user, 'role', 'student'),
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # 🔥 ИСПРАВЛЕНИЕ 3: Теперь мы точно увидим, из-за чего падает сервер!
            logger.error(f"Ошибка Telegram логина: {str(e)}")
            return Response({"error": f"Критическая ошибка БД: {str(e)}"}, status=500)

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        # 1. Если у пользователя УЖЕ ЕСТЬ нормальный пароль (он регался сам)
        if user.has_usable_password():
            if not old_password:
                return Response({"error": "Пожалуйста, введите текущий пароль."}, status=status.HTTP_400_BAD_REQUEST)
            if not user.check_password(old_password):
                return Response({"error": "Текущий пароль введен неверно."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Проверяем новый пароль
        if not new_password or len(new_password) < 6:
            return Response({"error": "Новый пароль должен содержать минимум 6 символов."}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Сохраняем новый пароль
        user.set_password(new_password)
        user.save()

        return Response({"message": "Пароль успешно обновлен!"}, status=status.HTTP_200_OK)


# Изменение email для авторизованных пользователей (двухэтапная верификация через код на новый email)

class RequestEmailChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        new_email = request.data.get('new_email')
        
        if not new_email:
            return Response({"error": "Укажите новый email"}, status=status.HTTP_400_BAD_REQUEST)

        # Проверяем, не занят ли email другим человеком
        if User.objects.filter(email=new_email).exclude(id=request.user.id).exists():
            return Response({"error": "Этот email уже используется другим пользователем"}, status=status.HTTP_400_BAD_REQUEST)

        # Генерируем 6-значный код
        otp_code = str(random.randint(100000, 999999))

        # Сохраняем в кэш Django (живет 10 минут)
        cache_key = f"email_change_{request.user.id}"
        cache.set(cache_key, {'new_email': new_email, 'otp': otp_code}, timeout=600)

        # Отправляем письмо с кодом
        try:
            send_mail(
                subject='Код подтверждения SaqBol',
                message=f'Ваш код для подтверждения нового email: {otp_code}\n\nКод действителен 10 минут. Никому не сообщайте его.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[new_email],
                fail_silently=False,
            )
        except Exception as e:
            # 🔥 ТЕПЕРЬ ОН ПОКАЖЕТ ИСТИННУЮ ПРИЧИНУ ПОЧЕМУ НЕ ОТПРАВИЛОСЬ ПИСЬМО
            logger.error(f"Ошибка SMTP: {str(e)}")
            return Response({"error": f"Ошибка почты: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "Код отправлен на новый email"}, status=status.HTTP_200_OK)


class VerifyEmailChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get('code')
        cache_key = f"email_change_{request.user.id}"
        cache_data = cache.get(cache_key)

        if not cache_data:
            return Response({"error": "Код истек или не был запрошен"}, status=status.HTTP_400_BAD_REQUEST)

        if cache_data['otp'] != code:
            return Response({"error": "Неверный код"}, status=status.HTTP_400_BAD_REQUEST)

        # Если код верный — меняем почту в БД
        user = request.user
        user.email = cache_data['new_email']
        user.save()

        # Удаляем использованный код из кэша
        cache.delete(cache_key)

        return Response({"message": "Email успешно изменен!"}, status=status.HTTP_200_OK)

# ---------------------------
# Админ-панель: Модерация заявок
# ---------------------------
class PendingTeacherApplicationsView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = TeacherApplicationSerializer

    def get_queryset(self):
        # Возвращаем заявки, ожидающие проверки (статус 'pending')
        return TeacherApplication.objects.filter(status='pending')

class UpdateTeacherApplicationStatusView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAdminUser]
    queryset = TeacherApplication.objects.all()
 
    def patch(self, request, *args, **kwargs):
        application = self.get_object()
        new_status = request.data.get('status')
        reason = request.data.get('rejection_reason', 'Причина не указана')
 
        from notifications.service import send_notification
 
        if new_status == 'accepted':
            application.status = 'accepted'
            user = application.user
            user.role = 'teacher'
            user.save()
            application.save()
 
            # ✅ Уведомление об одобрении
            send_notification(
                recipient=user,
                notification_type='app_approved',
                title='Заявка одобрена',
                message=(
                    'Поздравляем! Ваша заявка на статус автора одобрена. '
                    'Теперь вы можете создавать и публиковать курсы. '
                    'Перезайдите в аккаунт чтобы изменения применились.'
                ),
            )
        else:
            application.status = 'rejected'
            application.save()
 
            # ✅ Уведомление об отклонении с причиной
            send_notification(
                recipient=application.user,
                notification_type='app_rejected',
                title='Заявка отклонена',
                message=(
                    f'К сожалению, ваша заявка на статус автора была отклонена.\n\n'
                    f'Причина: {reason}\n\n'
                    f'Вы можете подать новую заявку после исправления замечаний.'
                ),
            )
 
        return Response({"message": f"Статус заявки изменён на {new_status}"})


class PlatformStatsView(APIView):
    """
    GET /users/stats/
    Статистика платформы для админ-дашборда.
    Доступна только администраторам.
    """
    permission_classes = [permissions.IsAdminUser]
 
    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from courses.models import Course, Enrollment, Lesson, LessonStep
        from quizzes.models import Result
 
        now = timezone.now()
        week_ago  = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
 
        # ── ПОЛЬЗОВАТЕЛИ ─────────────────────────────────────────
        total_users    = User.objects.count()
        new_this_week  = User.objects.filter(date_joined__gte=week_ago).count()
        new_this_month = User.objects.filter(date_joined__gte=month_ago).count()
        total_students = User.objects.filter(role='student').count()
        total_teachers = User.objects.filter(role='teacher').count()
 
        # ── КУРСЫ ────────────────────────────────────────────────
        total_courses     = Course.objects.count()
        published_courses = Course.objects.filter(status='published').count()
        draft_courses     = Course.objects.filter(status='draft').count()
        pending_courses   = Course.objects.filter(status='review').count()
        total_lessons     = Lesson.objects.count()
        total_steps       = LessonStep.objects.count()
 
        # ── АКТИВНОСТЬ ───────────────────────────────────────────
        total_enrollments    = Enrollment.objects.count()
        enrollments_30d      = Enrollment.objects.filter(enrolled_at__gte=month_ago).count()
        total_quiz_results   = Result.objects.count()
        avg_quiz_score_data  = Result.objects.aggregate(avg=models.Avg('score'))
        avg_quiz_score       = round(avg_quiz_score_data['avg'] or 0, 1)
        passed_quizzes       = Result.objects.filter(score__gte=70).count()
        pass_rate            = round(passed_quizzes / total_quiz_results * 100, 1) if total_quiz_results else 0
 
        # ── ТОП КУРСОВ по записям ────────────────────────────────
        from django.db.models import Count
        top_courses = (
            Course.objects
            .filter(status='published')
            .annotate(enrollments_count=Count('enrolled_students'))
            .order_by('-enrollments_count')[:5]
            .values('id', 'title', 'enrollments_count')
        )
 
        # ── РЕГИСТРАЦИИ ПО ДНЯМ (последние 14 дней) ──────────────
        from django.db.models.functions import TruncDate
        registrations_by_day = (
            User.objects
            .filter(date_joined__gte=now - timedelta(days=14))
            .annotate(day=TruncDate('date_joined'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
 
        return Response({
            'users': {
                'total':         total_users,
                'students':      total_students,
                'teachers':      total_teachers,
                'new_this_week': new_this_week,
                'new_this_month': new_this_month,
            },
            'courses': {
                'total':     total_courses,
                'published': published_courses,
                'draft':     draft_courses,
                'pending':   pending_courses,
                'lessons':   total_lessons,
                'steps':     total_steps,
            },
            'activity': {
                'total_enrollments':  total_enrollments,
                'enrollments_30d':    enrollments_30d,
                'total_quiz_results': total_quiz_results,
                'avg_quiz_score':     avg_quiz_score,
                'pass_rate':          pass_rate,
            },
            'top_courses': list(top_courses),
            'registrations_by_day': [
                {'day': str(item['day']), 'count': item['count']}
                for item in registrations_by_day
            ],
        })