from rest_framework import generics, status, permissions
from rest_framework.response import Response
from .serializers import RegisterSerializer, UserSerializer

# Регистрация (Оставляем как было, тут все верно)
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

# Профиль (MeView)
# ИСПРАВЛЕНИЕ: Используем RetrieveUpdateAPIView вместо APIView.
# Это автоматически добавляет поддержку методов GET (просмотр) и PATCH (обновление).
class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    # Переопределяем этот метод, чтобы View знала, что "объект" — это текущий юзер из токена
    def get_object(self):
        return self.request.user