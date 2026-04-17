import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // 🔥 ИМПОРТИРУЕМ ХУК

function Privacy() {
    const { t } = useTranslation(); // 🔥 ПОДКЛЮЧАЕМ ПЕРЕВОДЫ

    return (
        <div className="min-h-screen bg-base-200 py-12 px-6 transition-colors duration-200" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="max-w-3xl mx-auto">
                {/* Кнопка назад */}
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-8">
                    <ArrowLeft size={16} /> {t('privacy.backToHome')}
                </Link>

                <div className="bg-base-100 rounded-[2rem] border border-base-300 shadow-sm p-8 md:p-12 transition-colors duration-200">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-center justify-center mb-6">
                        <ShieldCheck size={24} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-base-content mb-4">
                        {t('privacy.title')}
                    </h1>
                    <p className="text-sm font-semibold text-base-content/50 uppercase tracking-widest mb-10">
                        {t('privacy.lastUpdate')}
                    </p>

                    <div className="space-y-8 text-base-content/80 leading-relaxed font-medium">
                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('privacy.sec1Title')}</h2>
                            <p>
                                {t('privacy.sec1p1')}
                                <strong className="text-base-content">SaqBol LMS</strong>
                                {t('privacy.sec1p2')}
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('privacy.sec2Title')}</h2>
                            <ul className="list-disc pl-5 space-y-2 marker:text-blue-500">
                                <li><strong className="text-base-content">{t('privacy.li1Bold')}</strong>{t('privacy.li1Text')}</li>
                                <li><strong className="text-base-content">{t('privacy.li2Bold')}</strong>{t('privacy.li2Text')}</li>
                                <li><strong className="text-base-content">{t('privacy.li3Bold')}</strong>{t('privacy.li3Text')}</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('privacy.sec3Title')}</h2>
                            <p>
                                {t('privacy.sec3Text')}
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-2 marker:text-blue-500">
                                <li>{t('privacy.sec3li1')}</li>
                                <li>{t('privacy.sec3li2')}</li>
                                <li>{t('privacy.sec3li3')}</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('privacy.sec4Title')}</h2>
                            <p>
                                {t('privacy.sec4Text')}
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('privacy.sec5Title')}</h2>
                            <p>
                                {t('privacy.sec5Text')}
                                <a href="mailto:dev.saqbol@gmail.com" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                                    dev.saqbol@gmail.com
                                </a>
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Privacy;