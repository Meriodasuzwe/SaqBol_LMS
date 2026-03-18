import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie } from 'lucide-react';

function Cookies() {
    return (
        <div className="min-h-screen bg-base-200 py-12 px-6 transition-colors duration-200" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="max-w-3xl mx-auto">
                {/* Кнопка назад */}
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-8">
                    <ArrowLeft size={16} /> На главную
                </Link>

                <div className="bg-base-100 rounded-[2rem] border border-base-300 shadow-sm p-8 md:p-12 transition-colors duration-200">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 dark:border-blue-800">
                        <Cookie size={24} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-base-content mb-4">
                        Политика использования файлов Cookie
                    </h1>
                    <p className="text-sm font-semibold text-base-content/50 uppercase tracking-widest mb-10">
                        Последнее обновление: 11 Марта 2026
                    </p>

                    <div className="space-y-8 text-base-content/80 leading-relaxed font-medium">
                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">1. Что такое файлы cookie?</h2>
                            <p>
                                Файлы cookie — это небольшие текстовые файлы, которые сохраняются на вашем устройстве (компьютере, планшете или смартфоне) при посещении платформы <strong className="text-base-content">SaqBol LMS</strong>. Они помогают нам делать платформу удобнее, быстрее и безопаснее.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">2. Как мы используем cookie</h2>
                            <p className="mb-2">Мы используем файлы cookie для следующих целей:</p>
                            <ul className="list-disc pl-5 space-y-2 marker:text-blue-500">
                                <li><strong className="text-base-content">Строго необходимые:</strong> Для авторизации в системе, сохранения сессии и обеспечения безопасности ваших данных (защита от CSRF-атак). Без них платформа не сможет работать.</li>
                                <li><strong className="text-base-content">Функциональные:</strong> Для сохранения ваших настроек (например, выбора языка или темной темы), чтобы вам не приходилось настраивать их заново при каждом входе.</li>
                                <li><strong className="text-base-content">Аналитические:</strong> Для сбора анонимной статистики о том, как пользователи взаимодействуют с курсами. Это помогает нам улучшать образовательный процесс и интерфейс.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">3. Сторонние cookie</h2>
                            <p>
                                На нашей платформе могут использоваться файлы cookie сторонних сервисов (например, Google Analytics для сбора метрик). Эти сервисы обрабатывают данные в соответствии со своими собственными политиками конфиденциальности.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">4. Управление файлами cookie</h2>
                            <p>
                                Вы можете в любой момент изменить настройки файлов cookie в вашем браузере: заблокировать их или настроить уведомления об их использовании. Однако обратите внимание, что отключение строго необходимых cookie приведет к невозможности авторизации и прохождения курсов на платформе.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Cookies;