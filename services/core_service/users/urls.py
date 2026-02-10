from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import RegisterView, MeView

urlpatterns = [
    # Регистрация
    path('register/', RegisterView.as_view(), name='register'),
    
    # Логин (SimpleJWT)
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # Обновление токена
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Профиль (GET - получить инфо, PATCH - обновить инфо/фото)
    path('me/', MeView.as_view(), name='user_me'),
]