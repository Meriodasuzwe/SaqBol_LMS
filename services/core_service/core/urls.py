from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/courses/', include('courses.urls')), # Добавь эту строку
    path('', RedirectView.as_view(url='/admin/')),
    # Схема API в формате YAML
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Сам Swagger UI
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Альтернативная документация ReDoc
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/quizzes/', include('quizzes.urls')),
]