from django.contrib.auth import authenticate
from rest_framework import serializers
from .models import User


# ---------------------------
# Регистрация
# ---------------------------
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'iin', 'role')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            iin=validated_data.get('iin', ''),
            role=validated_data.get('role', 'student')
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
