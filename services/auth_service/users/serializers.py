from rest_framework import serializers
from .models import User

class RegisterSerializer(serializers.ModelSerializer):
    # Пароль должен быть только для записи. 
    # Мы не хотим, чтобы сервер когда-либо отправлял его обратно в ответе.
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        # Список полей, которые мы разрешаем передавать при регистрации
        fields = ('username', 'password', 'email', 'iin', 'role')

    def create(self, validated_data):
        """
        Метод вызывается, когда данные прошли проверку.
        """
        # ВАЖНО ДЛЯ БЕЗОПАСНОСТИ:
        # Мы используем create_user, а не просто create.
        # Это нужно, чтобы Django автоматически зашифровал (хэшировал) пароль.
        # В базе данных пароль никогда не будет лежать в открытом виде.
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            iin=validated_data.get('iin', ''),
            role=validated_data.get('role', 'student')
        )
        return user