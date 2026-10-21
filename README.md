# SaqBol LMS

SaqBol is an educational web application being developed into a platform for master's admission test preparation in Kazakhstan.

The project started as a university LMS project. Its current direction is preparation for Comprehensive Testing (CT / КТ), with a focus on clear learning materials, topic-based practice, answer explanations, and progress tracking.

## Project status

**Active development.** The repository contains the LMS foundation and an AI-assisted quiz authoring workflow. Adaptation to CT preparation is ongoing; complete subject coverage, full-length mock exams, and a learner-facing AI assistant are part of the development roadmap.

The first target track is **M094 - Information Technology**.

## Current functionality

- User authentication with JWT.
- Courses and lessons for organizing learning materials.
- Lesson quizzes with single-choice and multiple-choice questions.
- Navigation between questions and quiz variants within a lesson.
- Answer explanations, saved results, and attempt history.
- Server-side validation of submitted answers before grading and saving results.
- AI-assisted generation of draft quiz questions from lesson content.
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

## Author

**Rakhat Aliyev**
