import { Link } from 'react-router-dom';
import { ArrowLeft, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next'; 

function DataProcessing() {
    const { t } = useTranslation(); 

    return (
        <div className="min-h-screen bg-base-200 py-12 px-6 transition-colors duration-200" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="max-w-3xl mx-auto">
                {/* Кнопка назад */}
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-8">
                    <ArrowLeft size={16} /> {t('dataProcessing.backToHome')}
                </Link>

                <div className="bg-base-100 rounded-[2rem] border border-base-300 shadow-sm p-8 md:p-12 transition-colors duration-200">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-center justify-center mb-6">
                        <Database size={24} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-base-content mb-4">
                        {t('dataProcessing.title')}
                    </h1>
                    <p className="text-sm font-semibold text-base-content/50 uppercase tracking-widest mb-10">
                        {t('dataProcessing.subtitle')}
                    </p>

                    <div className="space-y-8 text-base-content/80 leading-relaxed font-medium">
                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('dataProcessing.sec1Title')}</h2>
                            <p>
                                {t('dataProcessing.sec1p1')}
                                <strong className="text-base-content">SaqBol LMS</strong>
                                {t('dataProcessing.sec1p2')}
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('dataProcessing.sec2Title')}</h2>
                            <p>
                                {t('dataProcessing.sec2p1_1')}
                                <strong className="text-base-content">{t('dataProcessing.dataProcessor')}</strong>
                                {t('dataProcessing.sec2p1_2')}
                                <strong className="text-base-content">{t('dataProcessing.dataController')}</strong>
                                {t('dataProcessing.sec2p1_3')}
                            </p>
                            <ul className="list-disc pl-5 space-y-2 mt-2 marker:text-blue-500">
                                <li>{t('dataProcessing.sec2li1')}</li>
                                <li>{t('dataProcessing.sec2li2')}</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('dataProcessing.sec3Title')}</h2>
                            <p>
                                {t('dataProcessing.sec3Text')}
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-base-content mb-3">{t('dataProcessing.sec4Title')}</h2>
                            <p>
                                {t('dataProcessing.sec4Text')}
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DataProcessing;