import React, { useState, useEffect } from 'react';
import { User, Shield, Mail, Key, Save, AlertTriangle, Eye, EyeOff, X } from 'lucide-react';
import api from '../api';
import { toast } from 'react-toastify';

function Settings() {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Данные профиля
    const [originalEmail, setOriginalEmail] = useState(''); // Запоминаем старую почту
    const [profileData, setProfileData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        username: ''
    });

    // Данные для пароля
    const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Состояния для модалки OTP
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get('users/me/');
            setProfileData({
                first_name: res.data.first_name || '',
                last_name: res.data.last_name || '',
                email: res.data.email || '',
                username: res.data.username || ''
            });
            setOriginalEmail(res.data.email || '');
        } catch (error) {
            toast.error("Не удалось загрузить профиль");
        } finally {
            setLoading(false);
        }
    };

    const isFakeEmail = profileData.email?.includes('@telegram.fake');

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // 1. Всегда сохраняем Имя и Фамилию (без email, чтобы избежать старой ошибки)
            await api.patch('users/me/', {
                first_name: profileData.first_name,
                last_name: profileData.last_name,
            });

            // 2. Если почта изменилась, запрашиваем код
            if (profileData.email !== originalEmail) {
                await api.post('users/request-email-change/', { new_email: profileData.email });
                setShowOtpModal(true); // Открываем модалку
                toast.info("Код подтверждения отправлен на новую почту!");
            } else {
                toast.success("Данные профиля успешно обновлены!");
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Ошибка при сохранении.";
            toast.error(errorMsg);
            // Если почта занята, откатываем значение обратно
            if (error.response?.data?.error?.includes('используется')) {
                setProfileData({ ...profileData, email: originalEmail });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (otpCode.length !== 6) {
            toast.warning("Код должен состоять из 6 цифр");
            return;
        }
        setVerifying(true);
        try {
            await api.post('users/verify-email-change/', { code: otpCode });
            toast.success("Email успешно обновлен!");
            setOriginalEmail(profileData.email); // Обновляем "старую" почту
            setShowOtpModal(false);
            setOtpCode('');
        } catch (error) {
            toast.error(error.response?.data?.error || "Неверный код");
        } finally {
            setVerifying(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            toast.error("Новые пароли не совпадают!"); return;
        }
        setSaving(true);
        try {
            await api.post('users/change-password/', { old_password: passwordData.old_password, new_password: passwordData.new_password });
            toast.success("Пароль успешно установлен!");
            setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
            setShowOld(false); setShowNew(false); setShowConfirm(false);
        } catch (error) {
            const errMsg = error.response?.data?.error || "Ошибка при смене пароля";
            toast.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        } finally {
            setSaving(false);
        }
    };

    const inputClasses = "w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all";
    const eyeBtnClasses = "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 flex items-center justify-center bg-transparent border-none cursor-pointer";

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 font-sans text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight">Настройки аккаунта</h1>
                <p className="text-slate-500 font-medium mt-2">Управляйте своими личными данными и безопасностью</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                
                <div className="w-full md:w-64 shrink-0">
                    <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
                        <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                            <User size={20} /> Личные данные
                        </button>
                        <button onClick={() => setActiveTab('security')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'security' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                            <Shield size={20} /> Безопасность
                        </button>
                    </nav>
                </div>

                <div className="flex-1">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            
                            {/* ПРОФИЛЬ */}
                            {activeTab === 'profile' && (
                                <div className="p-8 animate-in fade-in duration-300">
                                    <h2 className="text-xl font-extrabold mb-6">Личная информация</h2>
                                    {isFakeEmail && (
                                        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 items-start">
                                            <div className="bg-amber-100 text-amber-600 p-2 rounded-xl shrink-0"><AlertTriangle size={24} /></div>
                                            <div>
                                                <h3 className="text-amber-800 font-bold text-sm">Привяжите реальный Email</h3>
                                                <p className="text-amber-700 text-sm mt-1">Вы вошли через Telegram. Пожалуйста, измените временный email на ваш настоящий для восстановления доступа.</p>
                                            </div>
                                        </div>
                                    )}

                                    <form onSubmit={handleProfileSubmit} className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Имя</label>
                                                <input type="text" value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-blue-500 outline-none transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Фамилия</label>
                                                <input type="text" value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:border-blue-500 outline-none transition-all" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Электронная почта</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Mail size={18} /></div>
                                                <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className={`w-full pl-11 pr-4 py-3 bg-slate-50 border rounded-xl font-medium focus:bg-white focus:ring-4 outline-none transition-all ${isFakeEmail ? 'border-amber-300 focus:border-amber-500 text-amber-700' : 'border-slate-200 focus:border-blue-500'}`} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Имя пользователя (Логин)</label>
                                            <input type="text" value={profileData.username} disabled className="w-full px-4 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl font-medium cursor-not-allowed" />
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all">
                                                {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={18} />} Сохранить изменения
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* БЕЗОПАСНОСТЬ */}
                            {activeTab === 'security' && (
                                <div className="p-8 animate-in fade-in duration-300">
                                    <h2 className="text-xl font-extrabold mb-6">Управление паролем</h2>
                                    <form onSubmit={handlePasswordSubmit} className="space-y-6">
                                        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl mb-6 flex gap-3 items-start">
                                            <Shield className="shrink-0 mt-0.5" size={18} />
                                            <p>Здесь вы можете обновить свой пароль или установить локальный пароль для входа по email, если вы регистрировались через социальные сети.</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Старый пароль (оставьте пустым, если пароля нет)</label>
                                            <div className="relative">
                                                <input type={showOld ? "text" : "password"} value={passwordData.old_password} onChange={e => setPasswordData({...passwordData, old_password: e.target.value})} className={inputClasses} placeholder="••••••••" />
                                                <button type="button" onClick={() => setShowOld(!showOld)} className={eyeBtnClasses}>{showOld ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Новый пароль</label>
                                                <div className="relative">
                                                    <input type={showNew ? "text" : "password"} required minLength={6} value={passwordData.new_password} onChange={e => setPasswordData({...passwordData, new_password: e.target.value})} className={inputClasses} placeholder="Минимум 6 символов" />
                                                    <button type="button" onClick={() => setShowNew(!showNew)} className={eyeBtnClasses}>{showNew ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Подтвердите новый пароль</label>
                                                <div className="relative">
                                                    <input type={showConfirm ? "text" : "password"} required value={passwordData.confirm_password} onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})} className={inputClasses} placeholder="Повторите пароль" />
                                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={eyeBtnClasses}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all disabled:opacity-70">
                                                {saving && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} Обновить пароль
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>

            {/* МОДАЛКА ВВОДА КОДА ПОДТВЕРЖДЕНИЯ */}
            {showOtpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-extrabold text-lg">Подтверждение Email</h3>
                            <button onClick={() => { setShowOtpModal(false); setProfileData({...profileData, email: originalEmail}); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleVerifyOtp} className="p-6 space-y-6">
                            <p className="text-slate-600 text-sm">Мы отправили 6-значный код на адрес <strong>{profileData.email}</strong>. Пожалуйста, введите его ниже для подтверждения смены почты.</p>
                            <div>
                                <input 
                                    type="text" 
                                    maxLength={6}
                                    autoFocus
                                    value={otpCode}
                                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} // Разрешаем только цифры
                                    placeholder="123456"
                                    className="w-full text-center tracking-[0.5em] text-2xl font-bold py-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                                />
                            </div>
                            <button type="submit" disabled={verifying || otpCode.length !== 6} className="w-full flex justify-center items-center py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50">
                                {verifying ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Подтвердить код'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Settings;