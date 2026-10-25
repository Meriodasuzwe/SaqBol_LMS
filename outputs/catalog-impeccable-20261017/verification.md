# Каталог SAQBol: фактический результат проверки

17 октября 2026. Активный маршрут найден в `src/App.jsx`: `/courses` → `CourseList`; карточки ведут на `/courses/:id`. Проверялся настоящий компонент, не копия экрана. QuizPage, App, Navbar, backend, зависимости и глобальная тема в этой задаче не изменялись.

## Изменённые файлы

- `services/frontend/src/CourseList.jsx`: композиция каталога, локальные карточки, обложки и fallback, подписи контролов. Сохранён исходный блок state/effects/API/filtering. Убраны случайные students/duration, ошибочный fallback 63 мест и неподтверждённые рекламные показатели.
- `services/frontend/src/CourseCatalog.css`: только селекторы внутри `.saqbol-catalog`, имеющиеся theme tokens; сетка, типографика, состояния и мобильная панель.
- `services/frontend/src/i18n.js`: только sortLabel, clearSearch, closeFilters в courseList на ru/kk/en.
- `services/frontend/tests/runCatalogPreview.mjs`.
- `services/frontend/tests/catalog-preview/`: `.gitignore`, `apiStub.js`, `catalogFixture.mjs`, `index.html`, `main.jsx`, `OnboardingPreviewStub.jsx`, `preview.css`, `covers/artificial-blue.svg`, `covers/artificial-teal.svg`.
- `docs/design/catalog.md`; скриншоты и этот отчёт в `outputs/catalog-impeccable-20261017/`.

## Команды

Из `C:\Users\User\SaqBol_LMS\services\frontend`:

```powershell
node tests/runCatalogPreview.mjs
npm test
node tests/runCatalogPreview.mjs --build
```

- Preview успешно запущено на `http://127.0.0.1:4174/`; MemoryRouter открывает `/courses`. После проверки сервер остановлен.
- `npm test`: 19 passed, 0 failed, 0 skipped. Существующие audit reproduction тесты по другим участкам всё ещё подтверждают известные дефекты, а не их исправление.
- Изолированная сборка реального приложения выполнена после основного изменения и после единственной CSS-корректировки; обе exit 0, 2566 модулей. Последняя: 8.54 с. Предупреждения — CSS `@property --radialprogress`, JS chunk >500 kB.
- Из корня: `git -c safe.directory=C:/Users/User/SaqBol_LMS diff --check -- services/frontend/src/CourseList.jsx services/frontend/src/CourseCatalog.css services/frontend/src/i18n.js`: exit 0, только уведомление Git о LF/CRLF.
- `.agents/skills/impeccable/scripts/impeccable.cmd detect --json services/frontend/src/CourseList.jsx services/frontend/src/CourseCatalog.css`: один запуск, exit 0, `[]`.
- Отдельного lint script в package.json нет.

## Браузер: основной проход и одна корректировка

Сравнение до/после: одна и та же baseline-фикстура, русский язык, светлая тема, пустой поиск, без фильтров, сортировка popular, прокрутка в начале. Desktop viewport 1440×1000; mobile 390×844. IAB вернул JPEG 1425×990 и 375×812 соответственно; размеры внутри пар совпадают, изображения не редактировались.

| Проверка | Фактический результат |
|---|---|
| Исходная выдача | 9 опубликованных курсов, draft не отображается |
| Desktop/mobile | 3 колонки / 1 колонка; без горизонтального переполнения |
| Длинное название на телефоне | Полная строка сохранена; высота текста 224px равна scrollHeight, ширина карточки 341px равна scrollWidth |
| Отсутствующая обложка | Нейтральный fallback SAQBol |
| Локальная битая обложка | После ожидаемого 404 img заменён fallback; поломанной картинки нет |
| Курс без метрик | Нет metadata/progress блоков; показаны существующие название, категория, цена и действие |
| Поиск | «Курс без метрик» → 1 курс; несуществующая строка → 0 и пустое состояние |
| Категория | «Информационная безопасность» → 2 курса |
| Только бесплатные | 4 курса: 9401, 9402, 9403, 9407 |
| Сброс пустой выдачи | Возвращает 9 курсов и очищает поиск |
| Уровень | Checkbox выбирается; выдачу по-прежнему не фильтрует |
| Сортировка | Значение меняется, порядок остаётся прежним; это существующее ограничение |
| Переход в курс | Ссылка открыла `/courses/9405` в тестовой заглушке назначения |
| Локализация/темы | RU/light, KK/dark/mobile, EN/dark/desktop; исходные названия курсов не переводились искусственно |
| Мобильный сброс после исправления | Видим; сбрасывает free + level, все четыре checkbox false, снова 9 курсов |
| Панель после resize | При 1440px dialog.isVisible=false, как в исходном поведении |

Независимая проверка выявила два промаха основного прохода: скрытый вместе с повторным заголовком reset и отсутствие desktop-скрытия mobile overlay. Оба исправлены одной CSS-корректировкой; повторный вердикт `ship` относится к этим двум исправлениям. Других циклов полировки не было.

В журнале браузера остались сообщения Vite о временно неудачной HMR-перезагрузке во время записи файлов; финальная полная перезагрузка и сборка успешны. Намеренно недоступная тестовая обложка возвращает 404.

## Границы и невыполненные проверки

- Рабочая БД, пользовательские данные, секреты и `.env` не использовались. В приложении сохранены настоящие API-запросы; в preview они заменены ограниченным stub.
- Сортировка и фильтры уровня/длительности не реализованы в исходном каталоге. Этот редизайн не исправляет их; пагинации в исходном компоненте нет.
- Переход проверен до тестовой заглушки, не до реального CourseDetail. Реальные авторизация, доступ, оплата и серверная фильтрация не проверялись.
- Общие Navbar/Footer и Onboarding не проверялись визуально: preview воспроизводит wrapper main, onboarding отключён только test alias. Production Onboarding сохранён, его прежний текст не переадаптирован.
- Сценарии slow/error harness, полный keyboard/focus-trap аудит мобильной панели, остальные breakpoints/браузеры и физический телефон не проверялись.
- Приложение продолжает использовать поля image/cover_image/image_url. В preview обложки явно искусственные и локальные; существующие пользовательские изображения не читались и не заменялись.
