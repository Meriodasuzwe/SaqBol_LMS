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
        fields = ('username', 'password', 'email', 'iin') 

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            iin=validated_data.get('iin', ''),
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
        # 🔥 ДОБАВИЛИ age, avatar, first_name, last_name
        fields = ['id', 'username', 'email', 'role', 'iin', 'first_name', 'last_name', 'age', 'avatar']
        read_only_fields = ['role', 'username', 'email'] # Роль и логин менять через профиль нельзя


# ---------------------------
# Результаты тестов
# ---------------------------
class QuizResultSerializer(serializers.ModelSerializer):
    # Создаем псевдоним: фронт просит completed_at, мы берем данные из date
    completed_at = serializers.DateTimeField(source='date', read_only=True)

    class Meta:
        model = QuizAttempt
        # Возвращаем id, название теста, очки и "правильную" дату
        fields = ['id', 'quiz_title', 'score', 'completed_at']