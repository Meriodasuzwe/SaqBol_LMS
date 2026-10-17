# SaqBol LMS

Платформа обучения: React 19 / Vite, Django REST Framework, PostgreSQL 15,
Nginx, Prometheus и Grafana. Код отдельного FastAPI/Groq сервиса находится
в `services/ai_service`, но AI намеренно выключен в текущей конфигурации.

## Локальный запуск

Нужны Docker Desktop с Linux containers и Docker Compose. Команды выполняются
из корня проекта. Существующий `.env` и Docker volumes содержат настройки
и данные проекта — сохраняйте их при повторном запуске.

Для новой установки создайте `.env` с переменными:

```dotenv
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
POSTGRES_DB=saqbol_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-a-local-password
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

Запуск на этом компьютере:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build --wait --wait-timeout 180
docker compose ps
```

`docker-compose.local.yml` задаёт localhost для ссылок и CORS, включает DEBUG
и разрешает cookies по локальному HTTP. Не подключайте этот файл на публичном
сервере. Основной файл использует настройки из `.env`; это конфигурация
разработки с Django runserver и Vite, а не готовый production deployment.

Миграции и сбор static выполняются при запуске Django. Nginx ждёт готовности
Django и frontend; все шесть сервисов имеют healthcheck и `restart: unless-stopped`.
После ручного `stop` снова выполните команду `up` выше.

| Сервис | Адрес |
|---|---|
| Приложение | http://localhost/ |
| Django Admin | http://localhost/api/admin/ |
| Документация API | http://localhost/api/docs/ |
| Проверка Django и БД | http://localhost/api/health/ |
| Prometheus | http://localhost:9090/ |
| Grafana | http://localhost:3000/ |

Для новой базы администратор создаётся интерактивно:

```powershell
docker compose exec core_service python manage.py createsuperuser
```

## Диагностика

```powershell
docker compose ps -a
docker compose logs --tail 80 core_service nginx db_core
docker compose exec core_service python manage.py check
docker compose exec core_service python manage.py migrate --check
```

`/api/health/` возвращает 200 при доступной БД и 503 при недоступной.
В Prometheus на странице Targets цель `django_core` должна быть UP;
метрики собираются напрямую с `core-service:8000/prometheus/metrics`.
DNS alias использует дефис: Django не принимает HTTP Host с подчёркиванием.
Статус healthy проверяет доступность сервиса, но не все пользовательские сценарии.

Для остановки с сохранением данных:

```powershell
docker compose stop
```

Не используйте `docker compose down -v` для обычного перезапуска: флаг `-v`
удаляет тома БД и медиа.

## Проверки кода

Backend tests используют отдельную SQLite в памяти и локальную почту:

```powershell
docker compose exec core_service python -m pytest --ds=core.test_settings
```

Frontend:

```powershell
cd services/frontend
npm ci --legacy-peer-deps
npm test
npm run build
```

## Внешние интеграции

- AI отключён: `AI_ENABLED=false`; `/ai/` и Django AI-прокси возвращают 503.
  Ручное создание и сохранение тестов работают без Groq.
- Отправка почты требует `EMAIL_HOST_USER` и `EMAIL_HOST_PASSWORD`.
- Google-вход требует согласованных Google OAuth client settings и разрешённых origins.
- Stripe требует `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` и
  `STRIPE_WEBHOOK_SECRET`, а также доступного webhook.
- Telegram требует `TELEGRAM_BOT_TOKEN`.

При локальной проверке 17.10.2026 Telegram-виджет вернул `Bot domain invalid`
для localhost. Обычная форма входа доступна; Telegram-вход требует отдельной
настройки разрешённого домена у провайдера.

Наличие переменных не подтверждает действительность ключей или работу провайдера.
Локальные regression tests подменяют внешние запросы и не отправляют письма,
не выполняют платежи и не вызывают Groq.

## Результат локальной проверки 17.10.2026

Все шесть контейнеров healthy; Prometheus получает метрики (`django_core` UP).
Каталог загрузил 17 курсов в браузере. Админка, API docs и static отвечают 200.
Прошли 21 backend test, 10 frontend tests и 7 offline AI tests; frontend build
успешен. Backend tests выполнены на временной SQLite, AI tests — с подменённым
провайдером. Миграции существующей PostgreSQL применены, новых не требуется.

Это проверка восстановления сервисов и конкретных исправлений. Вопросы доступа
к платному контенту и другие пункты прежнего `docs/audit/` не закрыты полностью;
результат не означает готовность всех коммерческих сценариев.

## Структура

```text
services/core_service/   Django API, модели, миграции, тесты
services/frontend/       React-приложение
services/ai_service/     Отключённый AI-сервис
services/prometheus/     Сбор метрик
nginx/                   HTTP gateway, static/media
docker-compose.yml       Основная конфигурация сервисов
docker-compose.local.yml Настройки локального HTTP
```
