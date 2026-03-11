import { Link } from 'react-router-dom';
import { ArrowLeft, Database } from 'lucide-react';

function DataProcessing() {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="max-w-3xl mx-auto">
                {/* Кнопка назад */}
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors mb-8">
                    <ArrowLeft size={16} /> На главную
                </Link>

                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 md:p-12">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                        <Database size={24} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                        Согласие на обработку данных
                    </h1>
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-10">
                        В соответствии с Законодательством РК
                    </p>

                    <div className="space-y-8 text-slate-600 leading-relaxed font-medium">
                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Предмет согласия</h2>
                            <p>
                                Регистрируясь на платформе <strong>SaqBol LMS</strong>, Пользователь дает свое безусловное согласие на сбор, систематизацию, накопление, хранение, уточнение (обновление, изменение), использование и блокирование своих персональных данных.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Специфика корпоративного обучения (B2B)</h2>
                            <p>
                                Если доступ к платформе предоставлен вашим Работодателем, платформа SaqBol LMS выступает в роли <strong>Обработчика данных</strong>, а Работодатель — в роли <strong>Контроллера данных</strong>.
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-2 marker:text-blue-500">
                                <li>Платформа имеет право передавать отчеты о вашем прогрессе, результатах тестов и активности уполномоченным представителям вашего Работодателя.</li>
                                <li>Платформа не передает эти данные третьим лицам, не связанным с процессом вашего обучения.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Сроки хранения</h2>
                            <p>
                                Персональные данные хранятся в течение всего срока использования аккаунта на платформе, а также в течение 3 (трех) лет после его удаления в целях разрешения возможных юридических споров и формирования архивной аналитики.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Отзыв согласия</h2>
                            <p>
                                Пользователь вправе в любой момент отозвать свое согласие на обработку персональных данных, направив соответствующий запрос в службу поддержки. Обратите внимание, что отзыв согласия может повлечь за собой блокировку аккаунта, так как платформа не сможет обеспечивать образовательный процесс без хранения базовой информации.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DataProcessing;