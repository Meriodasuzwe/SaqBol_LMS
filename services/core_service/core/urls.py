from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    # Просто 'admin/', без api. Nginx сам разрулит.
    path('admin/', admin.site.urls),
    
    path('users/', include('users.urls')),
    path('courses/', include('courses.urls')),
    path('quizzes/', include('quizzes.urls')),
    
    # Swagger
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    path('prometheus/', include('django_prometheus.urls')),
]

