import logging
import uuid
import os
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import EmailVerification
from .models import TeacherApplication
from .serializers import (
    RegisterSerializer, 
    UserSerializer,
    PasswordResetRequestSerializer, 
    SetNewPasswordSerializer,
    VerifyEmailSerializer,
    ResendVerificationSerializer
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
                {"error": "Вы регистрировались через Google. Войдите через Google или нажмите 'Забыли пароль', чтобы создать локальный пароль."}, 
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