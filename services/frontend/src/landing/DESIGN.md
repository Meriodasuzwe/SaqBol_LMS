---
name: SAQBol landing lab
description: Isolated code-led landing concept; extracted from landing.css, not the global SAQBol identity.
colors:
  ink: "#171f30"
  ink-hover: "#293248"
  blue: "#293cd7"
  blue-hover: "#1b2cb1"
  paper: "#f5f6ee"
  white: "#fff"
  muted: "#525b65"
  line: "#d5d9ce"
  practice: "#182238"
  practice-text: "#f6f7ef"
  demo: "#f7f8f3"
  code: "#e9ece5"
  selected: "#e9edff"
  correct: "#3d7856"
  correct-surface: "#e9f2e8"
  focus: "#b34916"
  folio: "#2635b9"
  note: "#edb871"
  closing: "#dfe6f9"
typography:
  display:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "clamp(52px, 5.3vw, 82px)"
    fontWeight: 550
    lineHeight: 1.08
    letterSpacing: "-.04em"
  headline:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "clamp(34px, 3.2vw, 48px)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-.035em"
  title:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 450
    lineHeight: 1.3
    letterSpacing: "-.02em"
  intro:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.8
  button:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 550
  option:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.5
  code:
    fontFamily: "Consolas, 'Courier New', monospace"
    fontSize: "13px"
    lineHeight: 1.75
rounded:
  folio: "2px"
  note: "3px"
  option: "4px"
  action: "5px"
  demo: "9px"
  circle: "50%"
spacing:
  compact: "8px"
  inline: "12px"
  small: "16px"
  medium: "20px"
  mobile-gutter: "24px"
  content-gap: "30px"
  tablet-gutter: "32px"
  desktop-gutter: "56px"
  section-gap: "100px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.action}"
    padding: "17px 22px"
  button-ink-hover:
    backgroundColor: "{colors.ink-hover}"
  button-blue:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.action}"
    padding: "17px 22px"
  button-blue-hover:
    backgroundColor: "{colors.blue-hover}"
  answer-option:
    textColor: "{colors.ink}"
    typography: "{typography.option}"
    rounded: "{rounded.option}"
    padding: "13px"
  answer-option-selected:
    backgroundColor: "{colors.selected}"
  answer-option-correct:
    backgroundColor: "{colors.correct-surface}"
  demo-panel:
    backgroundColor: "{colors.demo}"
    textColor: "{colors.ink}"
    rounded: "{rounded.demo}"
    padding: "25px 30px 21px"
---

# Design System: SAQBol landing lab

## Overview

**Creative North Star: "Редакционная образовательная страница"**

Документ описывает реализованный изолированный концепт в `services/frontend/tests/landing-lab`. Источники — `landing.css`, `LandingConcept.jsx` и локальный README. Это снимок текущего кода, а не утверждение новой глобальной идентичности SAQBol или одобрения пользователем финального результата. Финальная визуальная проверка ещё ожидается.

Бумажный фон, крупная типографика Onest и фотография подготовки формируют спокойную учебную страницу. Синяя обложка и тёплая записка перекрывают фотографию; тёмная секция отделяет локальную SQL-демонстрацию. Направление реализовано сразу в коде в рамках разрешённого одного концепта.

**Key Characteristics:**

- Бумажная основа, чернильный текст и синий акцент.
- Локальный Onest и крупные заголовки с плотным межбуквенным интервалом.
- Учебные материалы поверх фотографии; плоские информационные секции.
- Нативные radio и details для локальной демонстрации и FAQ.

## Colors

### Primary

Синий выделяет вторую строку hero, основное приглашение к демонстрации, выбранный ответ и отдельные слова заголовков. Чернильная кнопка используется для проверки ответа и перехода на платформу. Значения и hover-варианты находятся во frontmatter.

### Secondary

Тёплая записка выделяет тему занятия. Зелёный обозначает правильный ответ и сопровождается текстом результата и значком; выбранный ответ использует отдельную синюю подложку.

### Neutral

Бумага служит основой страницы, тёмная учебная секция — контрастным окружением светлой демонстрации. Тонкие нейтральные линии разделяют список дисциплин и FAQ. Светло-синяя заключительная секция завершает страницу.

**The Scope Rule.** Эти цвета и композиционные решения действуют только внутри landing-lab; глобальные токены и другие страницы приложения не меняются.

## Typography

Onest загружается локально из `assets/Onest.ttf` как variable font (100–900), с `font-display: swap`; резервный стек указан во frontmatter. SQL использует отдельный моноширинный стек.

Display соответствует hero, headline — основным заголовкам секций, title — названиям дисциплин, intro — вводному абзацу, body — тексту процесса. Эти роли описывают конкретные элементы; единого размера для всего текста страницы код не задаёт.

При ширине до 1050px hero использует `clamp(43px, 5.3vw, 58px)`, до 760px — `clamp(38px, 8.9vw, 64px)`, до 380px — 36px. Заголовки секций на мобильном — 36px, FAQ — 29px, заключение — 32px. Мелкие подписи в текущем коде достигают 7–11px; это зафиксированное состояние, а не рекомендация расширять такую шкалу на другие поверхности.

## Layout

Навигация ограничена шириной 1424px, hero — 1312px, основные секции — 1248px, заключение и footer — 1360px. Hero содержит две колонки в отношении 1.13:1; процесс, профиль и FAQ используют 0.9:1. У основных секций исходный промежуток между колонками — 100px, затем 64px при ширине до 1350px и 38px до 1050px.

При ширине до 760px hero, процесс, профиль и FAQ становятся одноколоночными. Навигационные ссылки секций скрываются; языки и вход остаются. Основной мобильный отступ — 24px, промежуточный — 32px, широкий — 56px. Дополнительные условия действуют при ширине от 1600px и до 380px; полный перечень находится в sidecar.

Изображение имеет фиксированную высоту области, `object-fit: cover` и адаптивную позицию кадрирования. Обложка и записка остаются наложенными элементами, а не отдельными карточками сетки.

## Elevation & Depth

Глубина сосредоточена в hero: обложка повёрнута на −8°, записка — на 4°. Их мягкие тени записаны в sidecar. Остальная страница разделяет информацию фоном, линиями и пространством.

Hero появляется за 0.9s с движением на 16px и снятием размытия 3px. Кнопки меняют фон и поднимаются на 2px при hover; переход занимает 0.2s. При `prefers-reduced-motion: reduce` отключаются анимации, переходы, плавная прокрутка и подъём кнопок.

## Shapes

Небольшие скругления различают бумажную обложку, записку, ответы и кнопки; демонстрация имеет более мягкий угол. Круг используется только для маркеров и букв вариантов ответа. Значения перечислены во frontmatter.

## Components

### Buttons

Синие и чернильные действия имеют минимальную высоту 56px, стрелку справа и видимые hover/focus-состояния. Кнопка проверки занимает всю ширину панели, использует скругление ответа, минимальную высоту 49px и отступы 13px 16px. Disabled уменьшает непрозрачность до 0.45 и меняет курсор.

### Inputs / Fields

Варианты демонстрации — настоящие radio внутри связанных label. Невидимое поле сохраняет клавиатурное управление; фокус рисуется на label. Минимальная высота варианта — 48px. Выбор и правильный ответ имеют разные цветовые состояния. Значения существуют только в памяти страницы.

### Cards / Containers

Светлая панель демонстрации имеет внутренние отступы из frontmatter, разделитель заголовка, блок SQL и варианты. Обложка и записка — специальные элементы hero, а не универсальная карточная система.

### Navigation

Логотип, якоря секций, RU/ҚАЗ и вход образуют одну строку на широком экране. Активный язык отмечен `aria-pressed`, насыщенным текстом и весом 750. Якоря меняют цвет при hover. Skip-link становится видимым при фокусе.

### FAQ

Ответы раскрываются нативным `details/summary`. Разделитель остаётся на нижней границе строки; шеврон поворачивается на 180° при открытии. В sidecar сохранён автономный пример с клавиатурным фокусом.

### Focus

Ссылки, кнопки, поля и summary получают оранжевый контур 3px с отступом 5px. Label radio использует тот же контур с отступом 3px. Эти правила и автономные примеры находятся в sidecar.

## Do's and Don'ts

### Do:

- **Do** сохранять изоляцию CSS и ассетов внутри landing-lab.
- **Do** использовать нативные radio, details и видимый клавиатурный фокус.
- **Do** сохранять отдельные состояния выбранного и правильного ответа.
- **Do** уважать prefers-reduced-motion.

### Don't:

- **Don't** считать этот концепт утверждённой глобальной идентичностью SAQBol.
- **Don't** переносить композицию hero или мелкие подписи в глобальные правила приложения.
- **Don't** выдавать локальную SQL-демонстрацию за официальный экзамен или сохранённый результат.
