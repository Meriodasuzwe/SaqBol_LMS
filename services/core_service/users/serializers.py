from django.contrib.auth import get_user_model, authenticate
from rest_framework import serializers
from .models import User, QuizAttempt

User = get_user_model()

# ---------------------------
# Регистрация
# ---------------------------
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # Убрали 'role' из полей, чтобы нельзя было передать её в JSON
        fields = ('username', 'password', 'email', 'iin') 

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            iin=validated_data.get('iin', ''),
            # ЖЕСТКО прописываем 'student'. 
            role='student' 
        )
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
        # Возвращаем role, чтобы React знал, какие кнопки показывать
        fields = ['id', 'username', 'email', 'role', 'iin'] 


# ---------------------------
# Результаты тестов
# ---------------------------
class QuizResultSerializer(serializers.ModelSerializer):
    # Исправлено: убрали source='quiz.title', так как в модели QuizAttempt поле называется так же
    class Meta:
        model = QuizAttempt
        fields = ['id', 'quiz_title', 'score', 'date'] # Обрати внимание: в модели поле date, а не completed_at