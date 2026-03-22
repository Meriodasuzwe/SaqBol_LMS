from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Импортируем НАШИ вьюхи из соседнего файла views.py
from .views import (
    RegisterView, 
    MeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    VerifyEmailView,
    ResendVerificationView,
    CustomLoginView,
    ApplyTeacherView,
    TelegramAuthView,
    ChangePasswordView,
    RequestEmailChangeView,
    VerifyEmailChangeView,
    GoogleLoginView,
    # === НОВЫЕ ВЬЮХИ ДЛЯ АДМИН ПАНЕЛИ ===
    PendingTeacherApplicationsView,
    UpdateTeacherApplicationStatusView
)

urlpatterns = [
    # Регистрация
    path('register/', RegisterView.as_view(), name='register'),

    # Логин (по email и паролю)
    path('login/', CustomLoginView.as_view(), name='login'),
    
    path('google-login/', GoogleLoginView.as_view(), name='google_login'),
    # Обновление токена
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('telegram-auth/', TelegramAuthView.as_view(), name='telegram-auth'),
    # Профиль (GET - получить инфо, PATCH - обновить инфо/фото)
    path('me/', MeView.as_view(), name='user_me'),
    # Заявка на роль Учителя
    path('apply-teacher/', ApplyTeacherView.as_view(), name='apply_teacher'),
    
    # Сброс пароля
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    
    path('request-email-change/', RequestEmailChangeView.as_view(), name='request-email-change'),
    path('verify-email-change/', VerifyEmailChangeView.as_view(), name='verify-email-change'),
    # Подтверждение email
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend_verification'),

    # === МАРШРУТЫ ДЛЯ АДМИН ПАНЕЛИ (МОДЕРАЦИЯ ЗАЯВОК) ===
    path('admin/applications/pending/', PendingTeacherApplicationsView.as_view(), name='admin_pending_applications'),
    path('admin/applications/<int:pk>/update/', UpdateTeacherApplicationStatusView.as_view(), name='admin_update_application'),
]