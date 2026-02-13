
```markdown
# SaqBol LMS: AI-Powered & Secure Learning Platform

SaqBol is a modern, microservices-based Learning Management System (LMS) designed to automate teaching processes while maintaining enterprise-grade security. The core feature is an **AI Quiz Generator** that analyzes lesson content and creates interactive quizzes for students in seconds, combined with a **Stepik-style** multi-quiz interface.

## 🚀 Key Features

* **AI Quiz Laboratory:** Generate quizzes using Llama 3 (via Groq API) with customizable difficulty and question counts.
* **Teacher Panel:** Draft, review, edit, and save AI-generated questions before publishing them to the database.
* **Stepik-Style Navigation:** Students can seamlessly switch between multiple quiz variants within a single lesson, with real-time success tracking (color-coded UI).
* **🔒 Enterprise-Grade Security (Zero Trust):** * **API Gateway:** Nginx acts as a single entry point, handling routing and serving static/media files.
  * **Isolated Network:** Backend and AI services are hidden inside a private Docker network.
  * **Cross-Service Auth:** The FastAPI AI service securely verifies Django JWT tokens before executing generations.
* **🛡️ Audit & Monitoring:** Centralized security logging (`security.log` and `ai_security.log`) tracks login attempts, admin actions, and AI resource usage.

---

## 🛠 Tech Stack

* **Frontend:** React 18, Vite, Tailwind CSS, DaisyUI.
* **Core Backend:** Django 5, Django REST Framework, PostgreSQL.
* **AI Microservice:** FastAPI, Groq Python SDK, python-jose (JWT validation).
* **Infrastructure:** Docker, Docker Compose, Nginx (API Gateway / Reverse Proxy).

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

* [Docker](https://www.docker.com/get-started) and Docker Compose.
* A **Groq API Key** (Get it at [console.groq.com](https://console.groq.com/)).

---

## ⚙️ Installation & Setup

Follow these steps to get the project running locally:

### 1. Clone the Repository

```bash
git clone [https://github.com/your-username/SaqBol_LMS.git](https://github.com/your-username/SaqBol_LMS.git)
cd SaqBol_LMS

```

### 2. Configure Environment Variables

Create a `.env` file in the **root directory** of the project:

```bash
touch .env

```

Add your keys to the `.env` file. **Note:** The `DJANGO_SECRET_KEY` must be identical for both Core and AI services to validate JWT tokens.

```env
# AI Service Configuration
GROQ_API_KEY=gsk_your_secret_key_here

# Security
DJANGO_SECRET_KEY=your_super_secret_long_jwt_key_here

# Core Service Configuration
DEBUG=True
POSTGRES_DB=saqbol_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

```

### 3. Build and Start the Containers

Use Docker Compose to build images and spin up the entire isolated network:

```bash
docker-compose up -d --build

```

Thanks to the **Nginx API Gateway**, everything is now accessible via standard HTTP port 80:

* **Frontend (React):** `http://localhost/`
* **Backend API (Django):** `http://localhost/api/`
* **Django Admin Panel:** `http://localhost/api/admin/`
* **AI Service Swagger UI:** `http://localhost/ai/docs`

### 4. Database Migrations & Superuser

Run migrations to set up the database schema and create an admin account:

```bash
# Run migrations
docker-compose exec core_service python manage.py migrate

# Create admin (Teacher) account
docker-compose exec core_service python manage.py createsuperuser

```

---

## 🖥 Usage

1. **Login:** Access the platform at `http://localhost/` and log in with your credentials.
2. **Course Management:** Use the Django Admin at `http://localhost/api/admin/` to add courses and lessons.
3. **Generate Quizzes:**
* Navigate to the **Teacher Panel** via the main app interface.
* Select a lesson or paste custom lecture text.
* Adjust settings (difficulty, number of questions).
* Click **"Сгенерировать"**, review the drafted questions, manually edit if necessary, and hit **"Сохранить"**.


4. **Take Quizzes:** Go to a lesson and try the new Stepik-style multi-variant quiz interface!

---

## 📂 Project Structure

```text
SaqBol_LMS/
├── services/
│   ├── frontend/        # React + Tailwind (Runs on Nginx /)
│   ├── core_service/    # Django + DRF (Runs on Nginx /api/)
│   └── ai_service/      # FastAPI + Groq (Runs on Nginx /ai/)
├── nginx/               # API Gateway Configuration & Static serving
├── logs/                # Security Audit Trails (Ignored by Git)
├── docker-compose.yml   # Orchestration & Network isolation
└── .env                 # Secret keys (Not tracked by Git)

```

---

## 🤝 Contributing

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

```

