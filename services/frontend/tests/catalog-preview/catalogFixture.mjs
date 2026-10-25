// All values in this file are artificial design fixtures, never real course data.
const categories = [
    { id: 9301, title: 'Программирование основы' },
    { id: 9302, title: 'Информационная безопасность' },
    { id: 9303, title: 'Кибергигиена и осведомленность' },
    { id: 9304, title: 'Сетевая безопасность и Инфраструктура' },
    { id: 9305, title: 'Подготовление к магистратуре' },
];

function course(id, title, category, overrides = {}) {
    return {
        id, title, category, category_title: categories.find(item => item.id === category).title,
        description: '<p>Синтетическое описание для проверки каталога. Не опубликованный учебный материал.</p>',
        status: 'published', price: '0.00', image: '/covers/artificial-blue.svg',
        is_enrolled: false, progress: 0, students_count: 64, duration: 6,
        average_rating: 4.6, reviews_count: 14, level: 'beginner', preview_only: true,
        ...overrides,
    };
}

export const catalogFixture = {
    metadata: { synthetic: true, development_only: true, publish: false },
    categories,
    courses: [
        course(9401, 'SQL: выборка и фильтрация — учебный пример', 9305, { is_enrolled: true, progress: 43 }),
        course(9402, 'Python: первые программы — учебный пример', 9301, { is_enrolled: true, progress: 0, image: '/covers/artificial-teal.svg' }),
        course(9403, 'Кибергигиена для команды — учебный пример', 9303, { is_enrolled: true, progress: 100, image: null, duration: 2 }),
        course(9404, 'Очень длинное синтетическое название курса по защите информации: практические задания для распределённой команды, подробное повторение основных тем и подготовка к итоговой проверке знаний', 9302, {
            price: '24000.00', image: null, duration: 18, level: 'advanced',
            description: '<p>Длинное искусственное описание проверяет переносы и высоту карточки на телефоне и большом экране. Это только визуальная фикстура.</p>',
        }),
        course(9405, 'Сетевая безопасность: пример с битой обложкой', 9304, { price: '12500.00', image: '/covers/missing-synthetic.svg', duration: 8, level: 'intermediate' }),
        course(9406, 'Защита веб-приложений — учебный пример', 9302, { price: '35000.00', students_count: 128, duration: 12, level: 'advanced', image: '/covers/artificial-teal.svg' }),
        course(9407, 'Как распознать фишинг — учебный пример', 9303, { duration: 1, average_rating: 0, reviews_count: 0 }),
        course(9408, 'Алгоритмы и структуры данных — учебный пример', 9301, { price: '15900.00', image: null, level: 'intermediate', description: '' }),
        // Deliberately absent: duration, students_count, average_rating, reviews_count,
        // progress and level. The harness must not fill in missing metrics.
        {
            id: 9409, title: 'Курс без метрик — синтетическая проверка', category: 9305,
            category_title: 'Подготовление к магистратуре', description: '', status: 'published',
            price: '9000.00', image: '/covers/artificial-blue.svg', is_enrolled: false, preview_only: true,
        },
        course(9410, 'Синтетический черновик: не должен появиться в каталоге', 9301, { status: 'draft' }),
    ],
};
