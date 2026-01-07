from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .serializers import RegisterSerializer

class RegisterView(generics.CreateAPIView):
    # Указываем, какой "переводчик" использовать
    serializer_class = RegisterSerializer
    
    # Разрешаем доступ всем, так как это регистрация (логично же!)
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        # 1. Берем данные из запроса
        serializer = self.get_serializer(data=request.data)
        
        # 2. Проверяем их на валидность (например, правильный ли ИИН)
        if serializer.is_valid():
            # 3. Если всё ок — сохраняем пользователя
            user = serializer.save()
            return Response({
                "message": "Пользователь успешно создан!",
                "username": user.username
            }, status=status.HTTP_201_CREATED)
        
        # 4. Если ошибка — отдаем её фронтенду
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)