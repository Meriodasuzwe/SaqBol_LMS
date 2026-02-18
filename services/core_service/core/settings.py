from pathlib import Path
from datetime import timedelta
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# =========================
# SECURITY
# =========================

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'unsafe-dev-secret-key'
)

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ["*"]  # Временное решение для разработки. В проде нужно указать конкретные домены.


# =========================
# APPLICATIONS
# =========================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'drf_spectacular',
    'django_prometheus', # ✅ Мониторинг
    'courses',
    'quizzes',
    'rest_framework',
    'users',
]


# =========================
# MIDDLEWARE
# =========================

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware', # ✅ В САМОМ ВЕРХУ
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.SecurityAuditMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware', # ✅ В САМОМ НИЗУ
]


# =========================
# URLS / WSGI
# =========================

ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'


# =========================
# TEMPLATES
# =========================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


# =========================
# DATABASE
# =========================

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB'),
        'USER': os.getenv('POSTGRES_USER'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
        'HOST': os.getenv('POSTGRES_HOST', 'db_core'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
    }
}


# =========================
# AUTH & PASSWORDS (ИБ)
# =========================

AUTH_USER_MODEL = 'users.User'

# ✅ Оставляем только одну, строгую версию настроек
AUTH_PASSWORD_VALIDATORS = [
    {
        # Проверка, что пароль не похож на имя пользователя или email
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        # Минимальная длина (9 символов)
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 9,
        }
    },
    {
        # Проверка на распространенные пароли
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        # Проверка, что пароль не состоит только из цифр
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# =========================
# INTERNATIONALIZATION
# =========================

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# =========================
# STATIC & MEDIA
# =========================

# Nginx раздает статику по этому пути
STATIC_URL = '/api/static/' 
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Nginx раздает медиа по этому пути
MEDIA_URL = '/api/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


# =========================
# DRF + JWT
# =========================

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10/minute',  # Анонимы - 10 запросов в минуту
        'user': '100/minute'  # Юзеры - 100
    }
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
}


# =========================
# DEFAULT PK & SCHEMA
# =========================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SPECTACULAR_SETTINGS = {
    'TITLE': 'SaqBol LMS API',
    'DESCRIPTION': 'Система управления обучением с упором на безопасность',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_PATCH': True,
    'COMPONENT_NO_READ_ONLY_FIELDS': True,
}


# =========================
# CORS & PROXY
# =========================

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
]

if os.environ.get('CORS_ALLOW_ALL_IN_DEV', 'False') == 'True':
    CORS_ALLOW_ALL_ORIGINS = True

# Важно для работы за Nginx
FORCE_SCRIPT_NAME = '/api'

#USE_X_FORWARDED_HOST = True
#SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


# =========================
# LOGGING (Аудит)
# =========================

LOGS_DIR = os.path.join(BASE_DIR, 'logs')
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} | {message}',
            'style': '{',
        },
    },
    'handlers': {
        'security_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(LOGS_DIR, 'security.log'),
            'formatter': 'verbose',
        },
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'security': {
            'handlers': ['security_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# =========================
# EMERGENCY ALLOWED HOSTS
# =========================
# Разрешаем вообще всё, чтобы Docker-контейнеры могли общаться
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True