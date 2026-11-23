# SAQBol landing preview

Рабочая главная: `http://localhost/`, компонент `src/Landing.jsx` → `src/landing/LandingConcept.jsx`.
Общий язык приложения сохраняется через i18next. Внутренние переходы используют текущий домен.

Изолированное превью использует тот же компонент с флагом `preview`, искусственным SQL-вопросом и без API:

```powershell
cd services/frontend
node tests/runLandingLab.mjs
# http://127.0.0.1:4184
node tests/runLandingLab.mjs --build
npm test
```

В превью переходы в платформу ведут на `http://localhost/login`, `/courses`, `/exams`.
SQL-демонстрация работает только в памяти и не сохраняет попытку. Реальное тестирование открывается отдельной ссылкой.
Изображение иллюстративное, создано ImageGen. Ассеты, лицензия Onest и provenance.json находятся в `src/landing/assets`.
Токены и локальные правила оформления — `src/landing/DESIGN.md` и `.impeccable/design.json`.
Каталог, QuizPage, backend, БД и зависимости не изменены.
