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

from .models import EmailVerification
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