// Artificial development content only. Not an official KT question bank.
export function createBuilderFixture() {
    const steps = [
        { id: 903, lesson: 902, title: 'Демонстрационный SQL-тест', step_type: 'quiz', order: 1, content: '', scenario_data: { quiz_id: 904 } },
        { id: 905, lesson: 902, title: 'Искусственный текстовый шаг', step_type: 'text', order: 2, content: '<p>Этот шаг нужен только для проверки повторного открытия редактора вопросов.</p>', scenario_data: {} },
    ];
    return {
        course: { id: 901, title: 'Искусственный курс для проверки конструктора', description: '<p>Локальная тестовая фикстура. Не учебный материал для публикации.</p>', price: '0.00', status: 'draft', category: 900, cover_image: null },
        lessons: [{ id: 902, course: 901, title: 'SQL: искусственные вопросы', order: 1, steps }],
        quizzes: [{
            id: 904, lesson: 902, title: 'Демонстрационный SQL-тест', description: '',
            questions: [
                {
                    id: 910, text: 'Какое условие выбирает строки, у которых price больше 100?',
                    explanation: 'В демонстрационном примере условие WHERE price > 100 оставляет только строки с ценой больше 100.',
                    choices: [
                        { id: 911, text: 'WHERE price < 100', is_correct: false },
                        { id: 912, text: 'WHERE price > 100', is_correct: true },
                        { id: 913, text: 'ORDER BY price', is_correct: false },
                    ],
                },
                {
                    id: 920, text: 'Выберите оба условия, которым удовлетворяет значение price = 150.',
                    explanation: 'Число 150 больше 100 и меньше 200. Поэтому правильный набор содержит два варианта.',
                    choices: [
                        { id: 921, text: 'price > 100', is_correct: true },
                        { id: 922, text: 'price = 100', is_correct: false },
                        { id: 923, text: 'price < 200', is_correct: true },
                        { id: 924, text: 'price < 0', is_correct: false },
                    ],
                },
                {
                    id: 930, text: 'Какое условие проверяет отсутствие значения в столбце city?',
                    explanation: 'IS NULL проверяет отсутствие значения. Обычное сравнение с NULL не заменяет эту проверку.',
                    choices: [
                        { id: 931, text: 'city = NULL', is_correct: false },
                        { id: 932, text: 'city IS NULL', is_correct: true },
                        { id: 933, text: "city = ''", is_correct: false },
                    ],
                },
            ],
        }],
        requests: [],
        nextId: 1000,
    };
}
