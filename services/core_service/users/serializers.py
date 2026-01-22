from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
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
        # УБРАЛ 'role' из полей. Теперь API даже не будет читать это поле из JSON.
        fields = ('username', 'password', 'email', 'iin') 

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            iin=validated_data.get('iin', ''),
            # ЖЕСТКО прописываем 'student'. 
            # Даже если хакер подсунет поле role, мы его проигнорируем.
            role='student' 
        )
        return user


# ---------------------------
# Логин (Тут все ок)
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
        # ВАЖНО: А вот тут 'role' НУЖНО вернуть.
        # Почему? Потому что когда юзер залогинится, React должен узнать, 
        # кто это (студент или препод), чтобы показать правильные кнопки.
        # Но так как это UserSerializer (обычно на чтение), это безопасно.
        fields = ['id', 'username', 'email', 'role', 'iin'] 


# ---------------------------
# Результаты тестов
# ---------------------------
class QuizResultSerializer(serializers.ModelSerializer):
    quiz_title = serializers.ReadOnlyField(source='quiz.title')

    class Meta:
        model = QuizAttempt
        fields = ['id', 'quiz_title', 'score', 'status', 'completed_at']