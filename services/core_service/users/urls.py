from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import RegisterView

urlpatterns = [
    # Регистрация (использует твой RegisterSerializer через RegisterView)
    path('register/', RegisterView.as_view(), name='register'),
    
    # Логин (SimpleJWT сам создаст токены, используя данные, которые проверяет LoginSerializer)
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # Обновление токена
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]