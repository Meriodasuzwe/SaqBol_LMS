import logging
from django.contrib.auth import get_user_model, authenticate
from rest_framework import serializers
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import User, QuizAttempt, EmailVerification

# Инициализируем логгер
logger = logging.getLogger(__name__)

User = get_user_model()


# ---------------------------
# Регистрация
# ---------------------------
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email') # ИИН УДАЛЕН ОТСЮДА

    def create(self, validated_data):
        # 1. Создаем пользователя, но делаем его НЕАКТИВНЫМ
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            role='student', # ИИН УДАЛЕН ОТСЮДА
            is_active=False  # <--- ВАЖНО: аккаунт заморожен до подтверждения!
        )

        # 2. Генерируем 6-значный код
        verification = EmailVerification.generate_code(user)

        # 3. Отправляем письмо с кодом
        try:
            send_mail(
                subject='Код подтверждения SaqBol LMS',
                message=f'Здравствуйте, {user.username}!\n\nВаш код для подтверждения регистрации: {verification.code}\nКод действителен в течение 10 минут.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Ошибка отправки email для {user.email}: {str(e)}")

        return user


# ---------------------------
# Логин
# ---------------------------
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs.get('username'),
            password=attrs.get('password')
        )

        if not user:
            raise serializers.ValidationError("Неверный логин или пароль")

        attrs['user'] = user
        return attrs


# ---------------------------
# Профиль пользователя
# ---------------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'age', 'avatar'] # ИИН УДАЛЕН ОТСЮДА
        read_only_fields = ['role', 'username', 'email'] # Роль и логин менять через профиль нельзя


# ---------------------------
# Результаты тестов
# ---------------------------
class QuizResultSerializer(serializers.ModelSerializer):
    completed_at = serializers.DateTimeField(source='date', read_only=True)

    class Meta:
        model = QuizAttempt
        fields = ['id', 'quiz_title', 'score', 'completed_at']


# ---------------------------
# Запрос на сброс пароля
# ---------------------------
class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        user = User.objects.filter(email=value).first()
        if user:
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = PasswordResetTokenGenerator().make_token(user)
            reset_link = f"{settings.FRONTEND_URL}/reset-password/{uidb64}/{token}"
            
            try:
                send_mail(
                    subject='Восстановление пароля в SaqBol LMS',
                    message=f'Здравствуйте, {user.username}!\n\nДля сброса пароля перейдите по ссылке:\n{reset_link}\n\nЕсли вы не запрашивали сброс, просто проигнорируйте это письмо.',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f"Ошибка отправки email сброса пароля для {user.email}: {str(e)}")

        return value


# ---------------------------
# Установка нового пароля
# ---------------------------
class SetNewPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    token = serializers.CharField(write_only=True)
    uidb64 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        password = attrs.get('password')
        token = attrs.get('token')
        uidb64 = attrs.get('uidb64')

        try:
            id = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(id=id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("Пользователь не найден или ссылка повреждена.")

        if not PasswordResetTokenGenerator().check_token(user, token):
            raise serializers.ValidationError("Ссылка устарела или уже была использована.")

        try:
            validate_password(password, user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        attrs['user'] = user
        return attrs

    def save(self, **kwargs):
        password = self.validated_data['password']
        user = self.validated_data['user']
        user.set_password(password)
        user.save()
        return user
    

# ---------------------------
# Подтверждение Email (6-значный код)
# ---------------------------
class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        email = attrs.get('email')
        code = attrs.get('code')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Пользователь с таким email не найден.")

        if user.is_active:
            raise serializers.ValidationError("Этот аккаунт уже подтвержден.")

        verification = EmailVerification.objects.filter(user=user, code=code).last()
        
        if not verification:
            raise serializers.ValidationError("Неверный код подтверждения.")
        
        if not verification.is_valid():
            raise serializers.ValidationError("Срок действия кода истек. Зарегистрируйтесь заново или запросите новый код.")

        attrs['user'] = user
        attrs['verification'] = verification
        return attrs
    

# ---------------------------
# Повторная отправка кода
# ---------------------------
class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.get('email')
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"error": "Пользователь с таким email не найден."})

        if user.is_active:
            raise serializers.ValidationError({"error": "Этот аккаунт уже подтвержден. Вы можете просто войти."})

        attrs['user'] = user
        return attrs