import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

function Privacy() {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="max-w-3xl mx-auto">
                {/* Кнопка назад */}
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors mb-8">
                    <ArrowLeft size={16} /> На главную
                </Link>

                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 md:p-12">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                        <ShieldCheck size={24} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                        Политика конфиденциальности
                    </h1>
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-10">
                        Последнее обновление: 11 Марта 2026
                    </p>

                    <div className="space-y-8 text-slate-600 leading-relaxed font-medium">
                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Общие положения</h2>
                            <p>
                                Настоящая политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей платформы <strong>SaqBol LMS</strong>. Мы с уважением относимся к личной информации наших пользователей и строго соблюдаем законодательство Республики Казахстан о персональных данных.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Какие данные мы собираем</h2>
                            <ul className="list-disc pl-5 space-y-2 marker:text-blue-500">
                                <li><strong>Учетные данные:</strong> ФИО, адрес электронной почты, должность.</li>
                                <li><strong>Данные об обучении:</strong> прогресс прохождения курсов, результаты тестов, выданные сертификаты.</li>
                                <li><strong>Технические данные:</strong> IP-адрес, тип браузера, файлы cookies для обеспечения корректной работы сессий.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Использование данных</h2>
                            <p>
                                Собранная информация используется исключительно для:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-2 marker:text-blue-500">
                                <li>Предоставления доступа к образовательным материалам.</li>
                                <li>Формирования аналитических отчетов для руководителей (B2B сегмент).</li>
                                <li>Улучшения алгоритмов ИИ-адаптации под каждого студента.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Безопасность</h2>
                            <p>
                                Мы используем современные методы шифрования и изолированные базы данных. Передача информации между вашим устройством и нашими серверами защищена протоколом SSL/TLS.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Контакты</h2>
                            <p>
                                Если у вас есть вопросы по поводу вашей конфиденциальности или вы хотите запросить удаление аккаунта, свяжитесь с нами по адресу:{' '}
                                <a href="mailto:dev.saqbol@gmail.com" className="text-blue-600 font-bold hover:underline">dev.saqbol@gmail.com</a>
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Privacy;