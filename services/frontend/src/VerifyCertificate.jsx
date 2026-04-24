import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Award, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from './api';

function VerifyCertificate() {
    const { certId } = useParams();
    const { t, i18n } = useTranslation();
    const [certData, setCertData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    
    // Стейты для смены языка
    const [activeLang, setActiveLang] = useState('ru'); 
    const [isRegenerating, setIsRegenerating] = useState(false);

    const getDateLocale = () => {
        if (i18n.language === 'en') return 'en-US';
        if (i18n.language === 'kk') return 'kk-KZ';
        return 'ru-RU';
    };

    useEffect(() => {
        api.get(`courses/certificates/verify/${certId}/`)
            .then(res => {
                setCertData(res.data);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [certId]);

    // Функция смены языка "на лету"
    const handleChangeLanguage = async (lang) => {
        if (lang === activeLang) return;
        setIsRegenerating(true);
        setActiveLang(lang);
        try {
            // Дергаем наш новый эндпоинт (путь проверь, чтобы совпадал с urls.py)
            const res = await api.post(`courses/certificates/${certId}/change-language/`, { language: lang });
            
            // Добавляем timestamp к URL, чтобы браузер не закешировал старую картинку
            const newUrl = `${res.data.file_url}?t=${new Date().getTime()}`;
            
            setCertData(prev => ({ ...prev, file_url: newUrl }));
            toast.success("Язык сертификата изменен!");
        } catch (err) {
            toast.error("Ошибка при обновлении сертификата");
        } finally {
            setIsRegenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <span className="loading loading-spinner text-blue-600 w-10"></span>
            </div>
        );
    }

    if (error || !certData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-4">
                <div className="bg-base-100 p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
                    <XCircle size={64} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-base-content mb-2">{t('verify.notFoundTitle')}</h2>
                    <p className="text-base-content/60 mb-6">{t('verify.notFoundDesc')}</p>
                    <Link to="/" className="btn bg-blue-600 hover:bg-blue-700 text-white w-full">
                        {t('verify.backToHome')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-4 font-sans">
            <div className="bg-base-100 rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full flex flex-col md:flex-row border border-base-200/50">
                
                {/* ── ЛЕВАЯ ЧАСТЬ: ИНФО ── */}
                <div className="p-8 md:w-[45%] flex flex-col justify-center border-b md:border-b-0 md:border-r border-base-200">
                    <div className="flex items-center gap-2 mb-6">
                        <Award className="text-blue-600 dark:text-blue-400" size={28} />
                        <span className="text-lg font-black tracking-tight text-base-content">SaqBol LMS</span>
                    </div>

                    {/* Фикс бейджика: сделал контрастным */}
                    <div className="inline-flex items-center gap-2 bg-emerald-500 text-white shadow-md shadow-emerald-500/20 px-4 py-2 rounded-full font-bold text-sm w-max mb-6">
                        <CheckCircle size={18} />
                        {t('verify.verifiedBadge')}
                    </div>

                    <h1 className="text-3xl font-bold mb-2 text-base-content">{certData.student_name}</h1>
                    <p className="text-base-content/60 text-sm mb-6">{t('verify.completedText')}</p>
                    
                    <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-6">{certData.course_title}</h2>

                    <div className="space-y-3 mb-8">
                        <div>
                            <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider">{t('verify.issueDate')}</p>
                            <p className="font-medium text-base-content">{new Date(certData.issued_at).toLocaleDateString(getDateLocale())}</p>
                        </div>
                        <div>
                            <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider">{t('verify.certId')}</p>
                            <p className="font-mono text-xs text-base-content break-all">{certData.id}</p>
                        </div>
                    </div>
                </div>

                {/* ── ПРАВАЯ ЧАСТЬ: СЕРТИФИКАТ И ТУМБЛЕР ── */}
                <div className="md:w-[55%] bg-base-200/50 dark:bg-base-200/20 p-8 flex flex-col items-center justify-center relative">
                    
                    {/* ТУМБЛЕР ЯЗЫКОВ */}
                    <div className="w-full flex items-center justify-between mb-6">
                        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider flex items-center gap-1.5">
                            <Globe size={14} /> Язык документа
                        </p>
                        
                        <div className="flex bg-base-300/50 p-1 rounded-lg">
                            {['ru', 'kk', 'en'].map((lang) => (
                                <button
                                    key={lang}
                                    disabled={isRegenerating}
                                    onClick={() => handleChangeLanguage(lang)}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                                        activeLang === lang 
                                            ? 'bg-base-100 text-blue-600 shadow-sm' 
                                            : 'text-base-content/50 hover:text-base-content'
                                    }`}
                                >
                                    {lang}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* КАРТИНКА */}
                    <div className="w-full relative">
                        {isRegenerating && (
                            <div className="absolute inset-0 z-10 bg-base-100/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-3">
                                <Loader2 size={32} className="text-blue-600 animate-spin" />
                                <span className="text-sm font-bold text-base-content/70">Генерация...</span>
                            </div>
                        )}

                        {certData.file_url ? (
                            <a href={certData.file_url} target="_blank" rel="noreferrer" className="relative group block rounded-lg overflow-hidden border border-base-300 shadow-md bg-white w-full">
                                <img 
                                    src={certData.file_url} 
                                    alt="Certificate" 
                                    className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-300" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                                    <span className="bg-white text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl hover:scale-105 transition-transform">
                                        {t('verify.openFull')} <ExternalLink size={16} />
                                    </span>
                                </div>
                            </a>
                        ) : (
                            <div className="w-full aspect-video bg-base-300 rounded-lg flex items-center justify-center border border-base-200">
                                <span className="text-base-content/40 text-sm font-medium">{t('verify.noImage')}</span>
                            </div>
                        )}
                    </div>
                    
                    <a 
                        href={certData.file_url} 
                        download
                        className="mt-6 w-full py-3 bg-base-100 border border-base-300 hover:border-blue-400 text-base-content font-bold rounded-xl flex justify-center items-center gap-2 transition-all hover:shadow-md"
                    >
                        Скачать PDF / PNG
                    </a>
                </div>
            </div>
        </div>
    );
}

export default VerifyCertificate;