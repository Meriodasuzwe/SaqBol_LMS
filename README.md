# SaqBol LMS: AI-Powered Learning Platform

SaqBol is a modern Learning Management System (LMS) designed to automate the boring parts of teaching. The core feature is an **AI Quiz Generator** that analyzes lesson content and creates interactive quizzes for students in seconds.

## 🚀 Key Features

* **AI Quiz Laboratory:** Generate quizzes using Llama 3.3 (via Groq API) with customizable difficulty and question counts.
* **Teacher Panel:** Draft, review, and save AI-generated questions before they go live.
* **Microservices Architecture:** Scalable setup with separate services for the Core (Django), Frontend (React), and AI (FastAPI).
* **Student Progress:** Real-time quiz results, scoring system, and profile tracking.
* **Modern UI:** Clean and responsive interface built with Tailwind CSS and DaisyUI.

---

## 🛠 Tech Stack

* **Frontend:** React 18, Vite, Tailwind CSS, DaisyUI.
* **Core Backend:** Django 5, Django REST Framework, PostgreSQL.
* **AI Microservice:** FastAPI, Groq Python SDK.
* **Infrastructure:** Docker, Docker Compose.

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
git clone https://github.com/your-username/SaqBol_LMS.git
cd SaqBol_LMS

```

### 2. Configure Environment Variables

Create a `.env` file in the **root directory** of the project:

```bash
touch .env

```

Add your Groq API key to the `.env` file:

```env
# AI Service Configuration
GROQ_API_KEY=gsk_your_secret_key_here

# Core Service Configuration (Optional customizations)
DEBUG=1
POSTGRES_DB=saqbol_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

```

### 3. Build and Start the Containers

Use Docker Compose to build images and spin up all services:

```bash
docker-compose up -d --build

```

This command will start:

* **Frontend:** `http://localhost:5173`
* **Backend API:** `http://localhost:8000`
* **AI Service:** `http://localhost:8001`
* **Database:** PostgreSQL (Internal)

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

1. **Login:** Access the platform at `http://localhost:5173` and log in with your credentials.
2. **Course Management:** Use the Django Admin at `http://localhost:8000/admin` to add courses and lessons.
3. **Generate Quizzes:**
* Navigate to the **Teacher Panel**.
* Select a lesson or paste custom lecture text.
* Adjust settings (difficulty, number of questions).
* Click **"Create Draft"**, review the questions, and hit **"Save to Lesson"**.



---

## 📂 Project Structure

```text
SaqBol_LMS/
├── services/
│   ├── frontend/        # React + Tailwind
│   ├── core_service/    # Django + DRF (LMS Logic)
│   └── ai_service/      # FastAPI + Groq (AI Logic)
├── docker-compose.yml   # Orchestration
└── .env                 # Secret keys (Not tracked by Git)

```

---

## 🤝 Contributing

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

