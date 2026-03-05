from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
# Вот здесь мы импортируем НАШИ вьюхи из соседнего файла views.py
from .views import (
    RegisterView, 
    MeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    VerifyEmailView,
    ResendVerificationView,
    CustomLoginView,
    ApplyTeacherView,
    GoogleLoginView
)

urlpatterns = [
    # Регистрация
    path('register/', RegisterView.as_view(), name='register'),

    # Логин (по email и паролю)
    path('login/', CustomLoginView.as_view(), name='login'),
    
    path('google-login/', GoogleLoginView.as_view(), name='google_login'),
    # Обновление токена
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Профиль (GET - получить инфо, PATCH - обновить инфо/фото)
    path('me/', MeView.as_view(), name='user_me'),
    # Заявка на роль Учителя
    path('apply-teacher/', ApplyTeacherView.as_view(), name='apply_teacher'),
    
    # Сброс пароля
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    # Подтверждение email
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend_verification'),
]