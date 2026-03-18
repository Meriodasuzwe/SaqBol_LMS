import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

function Terms() {
    return (
        <div className="min-h-screen bg-base-200 py-12 px-6 transition-colors duration-200" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="max-w-3xl mx-auto">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-8">
                    <ArrowLeft size={16} /> На главную
                </Link>

                <div className="bg-base-100 rounded-[2rem] border border-base-300 shadow-sm p-8 md:p-12 transition-colors duration-200">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-center justify-center mb-6">
                        <FileText size={24} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-base-content mb-4">
                        Пользовательское соглашение
                    </h1>
                    <p className="text-sm font-semibold text-base-content/50 uppercase tracking-widest mb-10">
                        Редакция от: 11 Марта 2026
                    </p>

                    <div className="space-y-8 text-base-content/80 leading-relaxed font-medium">
                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">1. Предмет соглашения</h2>
                            <p>
                                Платформа <strong className="text-base-content">SaqBol LMS</strong> предоставляет пользователям доступ к образовательным курсам, интерактивным тренажерам и системам тестирования. Настоящее соглашение регулирует правила использования сервиса как физическими, так и юридическими лицами (B2B).
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">2. Права и обязанности сторон</h2>
                            <ul className="list-disc pl-5 space-y-2 marker:text-blue-500">
                                <li><strong className="text-base-content">Пользователь обязуется:</strong> указывать достоверные данные при регистрации, не передавать доступ к аккаунту третьим лицам и не копировать материалы курсов.</li>
                                <li><strong className="text-base-content">Платформа обязуется:</strong> обеспечивать круглосуточный доступ к оплаченным материалам (за исключением времени на тех. обслуживание) и сохранять прогресс обучения.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">3. Интеллектуальная собственность</h2>
                            <p>
                                Все материалы на платформе (тексты, видео, код тренажеров, дизайн) являются интеллектуальной собственностью SaqBol LMS. Их распространение, перепродажа или публикация на других ресурсах без письменного разрешения строго запрещены.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">4. Ответственность</h2>
                            <p>
                                Платформа не несет ответственности за сбои в работе, возникшие по вине интернет-провайдеров или из-за использования устаревшего оборудования/браузеров со стороны пользователя.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Terms;