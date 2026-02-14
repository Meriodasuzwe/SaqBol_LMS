from pathlib import Path
from datetime import timedelta
import os

BASE_DIR = Path(__file__).resolve().parent.parent

MEDIA_URL = '/media/'
# Физическая папка внутри контейнера, где лежат файлы
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
# =========================
# SECURITY
# =========================

# Берём SECRET_KEY из окружения, если нет — используем dev-ключ
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'unsafe-dev-secret-key'
)

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


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
    'courses',
    'quizzes',
    'rest_framework',
    'users',
]


# =========================
# MIDDLEWARE
# =========================

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.SecurityAuditMiddleware'
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
# AUTH
# =========================

AUTH_USER_MODEL = 'users.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# =========================
# INTERNATIONALIZATION
# =========================

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# =========================
# STATIC
# =========================

# URL, по которому Nginx будет запрашивать файлы
STATIC_URL = '/api/static/' 

# Папка внутри контейнера core_service, куда соберутся все файлы
# Она должна совпадать с путем в docker-compose volumes
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Для загрузки файлов (аватарки)
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
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# =========================
# DEFAULT PK
# =========================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SPECTACULAR_SETTINGS = {
    'TITLE': 'SaqBol LMS API',
    'DESCRIPTION': 'Система управления обучением с упором на безопасность',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    # Настройка для работы с JWT в интерфейсе
    'COMPONENT_SPLIT_PATCH': True,
    'COMPONENT_NO_READ_ONLY_FIELDS': True,
}

# Безопасная конфигурация CORS
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
]

# Для разработки можно разрешить все origins через переменную окружения
if os.environ.get('CORS_ALLOW_ALL_IN_DEV', 'False') == 'True':
    CORS_ALLOW_ALL_ORIGINS = True
    

# Добавь это в конец файла
FORCE_SCRIPT_NAME = '/api'
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


# =========================
# LOGGING (Аудит безопасности)
# =========================
# Папка для логов внутри контейнера
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
        # Записываем в файл
        'security_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(LOGS_DIR, 'security.log'),
            'formatter': 'verbose',
        },
        # Выводим в консоль Docker (чтобы видеть через docker logs)
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