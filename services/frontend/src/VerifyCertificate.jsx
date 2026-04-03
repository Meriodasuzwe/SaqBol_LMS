import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Award, ExternalLink } from 'lucide-react';
import api from './api'; // Убедись, что путь до api верный

function VerifyCertificate() {
    const { certId } = useParams();
    const [certData, setCertData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

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
                    <h2 className="text-2xl font-black text-base-content mb-2">Сертификат не найден</h2>
                    <p className="text-base-content/60 mb-6">Возможно, ссылка устарела, либо сертификат был отозван.</p>
                    <Link to="/" className="btn btn-primary w-full">На главную SaqBol</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-4 font-sans">
            <div className="bg-base-100 rounded-3xl shadow-2xl overflow-hidden max-w-3xl w-full flex flex-col md:flex-row">
                
                {/* Левая часть: Статус верификации */}
                <div className="p-8 md:w-1/2 flex flex-col justify-center border-b md:border-b-0 md:border-r border-base-200">
                    <div className="flex items-center gap-2 mb-6">
                        <Award className="text-blue-600" size={28} />
                        <span className="text-lg font-black tracking-tight">SaqBol LMS</span>
                    </div>

                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full font-bold text-sm w-max mb-6">
                        <CheckCircle size={18} />
                        Подлинный сертификат
                    </div>

                    <h1 className="text-3xl font-bold mb-2 text-base-content">{certData.student_name}</h1>
                    <p className="text-base-content/60 text-sm mb-6">Успешно завершил(а) курс:</p>
                    
                    <h2 className="text-xl font-bold text-blue-600 mb-6">{certData.course_title}</h2>

                    <div className="space-y-3 mb-8">
                        <div>
                            <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider">Дата выдачи</p>
                            <p className="font-medium text-base-content">{new Date(certData.issued_at).toLocaleDateString('ru-RU')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider">ID сертификата</p>
                            <p className="font-mono text-sm text-base-content">{certData.id}</p>
                        </div>
                    </div>
                </div>

                {/* Правая часть: Превью самого сертификата */}
                <div className="md:w-1/2 bg-base-200/50 p-8 flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-4 w-full text-center">Оригинал документа</p>
                    
                    {certData.file_url ? (
                        <a href={certData.file_url} target="_blank" rel="noreferrer" className="relative group block rounded-lg overflow-hidden border border-base-300 shadow-md">
                            <img src={certData.file_url} alt="Certificate" className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="bg-white text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                                    Открыть в полном размере <ExternalLink size={16} />
                                </span>
                            </div>
                        </a>
                    ) : (
                        <div className="w-full aspect-video bg-base-300 rounded-lg flex items-center justify-center">
                            <span className="text-base-content/40">Изображение недоступно</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default VerifyCertificate;