# SaqBol LMS

SaqBol is an educational web application being developed into a platform for master's admission test preparation in Kazakhstan.

The project started as a university LMS project. Its current direction is preparation for Comprehensive Testing (KTA / КТ), with a focus on clear learning materials, topic-based practice, answer explanations, and progress tracking.

## Project status

**Active development.** The repository contains the LMS foundation and an AI-assisted quiz authoring workflow. Adaptation to CT preparation is ongoing; complete subject coverage, full-length mock exams, and a learner-facing AI assistant are part of the development roadmap.

The first target track is **M094 - Information Technology**.

## Current functionality

- User authentication with JWT.
- Courses and lessons for organizing learning materials.
- Lesson quizzes with single-choice and multiple-choice questions.
- Navigation between questions and quiz variants within a lesson.
- Answer explanations and saved results. Complete, immutable attempt history is still being developed.
- Server-side validation of submitted answers before grading and saving results.
- Code for AI-assisted generation of draft quiz questions from lesson content; AI is disabled in the current local configuration.
- Teacher tools for reviewing and editing generated questions before saving them.

## CT preparation scope

The first public version is planned to cover four subjects:

- Algorithms and Data Structures.
- Databases.
- ТГО.
- English.

Lessons will use short explanations, worked examples, tables, and diagrams, followed by practice questions. The planned practice modes include lesson exercises, module tests, subject-specific mock exams, and a full mock exam.

Learners will be able to follow a recommended study path or choose topics freely. Completed material, practice results, and topics that need revision will be tracked separately.

The interface is designed primarily for desktop and laptop use, with responsive layouts for phones. Russian is the initial language for learning materials and explanations; a Kazakh version is planned for the next stage.

## AI features

### Quiz authoring

The existing authoring workflow uses a separate FastAPI service and the Groq API to generate draft questions from lesson content. Generated questions can be reviewed and edited through the teacher interface before they are saved.

The current local configuration keeps AI disabled (`AI_ENABLED=false`). Manual question editing and saving work without Groq.

Content review remains part of the authoring process: generated questions need a checked answer and a clear explanation.

### Learner assistant — planned

The first learner-facing AI features are intended to:

- Explain a mistake using the question, the learner's answer, and the prepared solution.
- Clarify a lesson fragment and provide an additional example.

In mock-exam mode, assistance is planned for the review stage after submission. Scores will be calculated using defined grading rules independently of the assistant.

## Technology stack

| Component | Technologies | Responsibility |
| --- | --- | --- |
| Frontend | React, Vite, Tailwind CSS, DaisyUI | Learning interface, quiz navigation, and results |
| Core backend | Django, Django REST Framework | Users, learning content, quizzes, and grading |
| Database | PostgreSQL | Application data and learning results |
| AI service | FastAPI, OpenAI Python SDK | Draft question generation |
| Authentication | JWT, python-jose | Authentication and token validation |
| Infrastructure | Docker, Docker Compose, Nginx | Service orchestration, routing, and static/media delivery |

The Django backend handles the main learning workflows. AI-assisted question generation runs in a separate FastAPI service. Docker Compose provides the service environment, and Nginx handles incoming requests.

## Development roadmap

### First public release

- [ ] Organize preparation materials around the CT syllabus for M094 and the common subjects.
- [ ] Build a reviewed question bank with topic, difficulty, question type, language, and explanation metadata.
- [ ] Add module tests, subject-specific mock exams, and full mock exams.
- [ ] Assemble mock exams according to the selected specification and reduce repeated questions where the available bank allows it.
- [ ] Add topic-level progress, mistake review, and study recommendations.
- [ ] Introduce the learner-facing AI assistant with controlled usage limits.
- [ ] Add paid access and payment integration.

### Further development

- [ ] Add learning materials and explanations in Kazakh.
- [ ] Expand to additional admission tracks as reviewed subject content becomes available.
- [ ] Develop workflows for subject authors and contributors.

Development priorities include consistent grading, access control, reliable attempt storage, and recovery after interrupted sessions.

## Learning content

SaqBol is an independent educational project. Its practice materials are intended for preparation and are not presented as official NTC exam questions.

The planned content process uses published specifications, topic lists, official examples, and recommended literature as references for original lessons and practice questions. Questions and explanations should be checked before publication.

## Изолированное превью конструктора

Для проверки редактирования вопросов без рабочей БД, `.env` и внешних сервисов используется настоящий CourseBuilder с искусственным API. При уже установленных frontend-зависимостях, из корня репозитория:

```powershell
cd services/frontend
node tests/runBuilderPreview.mjs
```

Откройте http://127.0.0.1:4177/. Не запускайте второй экземпляр, если этот адрес уже работает. Все данные здесь искусственные и хранятся только в памяти процесса. Это не официальный учебный материал КТ и не проверка реальной БД. Описание проверок и ограничений: [tests/builder-preview/README.md](services/frontend/tests/builder-preview/README.md).

Изолированная сборка полного frontend без загрузки `.env`, из `services/frontend`:

```powershell
npm test
node tests/runCatalogPreview.mjs --build
```

## Деплой

Автоматический деплой на VPS при push в `main` приостановлен. Workflow `.github/workflows/deploy.yml` запускается только вручную через `workflow_dispatch`. Слияние PR само по себе не запускает этот деплой.

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

## Author

**Rakhat Aliyev**
