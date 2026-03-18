import React, { useState, useEffect } from 'react';
import { User, Shield, Mail, Key, Save, AlertTriangle, Eye, EyeOff, X } from 'lucide-react';
import api from '../api';
import { toast } from 'react-toastify';

function Settings() {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Данные профиля
    const [originalEmail, setOriginalEmail] = useState('');
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
            await api.patch('users/me/', {
                first_name: profileData.first_name,
                last_name: profileData.last_name,
            });

            if (profileData.email !== originalEmail) {
                await api.post('users/request-email-change/', { new_email: profileData.email });
                setShowOtpModal(true); 
                toast.info("Код подтверждения отправлен на новую почту!");
            } else {
                toast.success("Данные профиля успешно обновлены!");
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Ошибка при сохранении.";
            toast.error(errorMsg);
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
            setOriginalEmail(profileData.email); 
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

    const inputClasses = "w-full pl-4 pr-12 py-3 bg-base-200 border border-base-300 rounded-xl font-medium text-base-content focus:border-blue-500 focus:bg-base-100 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all";
    const eyeBtnClasses = "absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content p-1 flex items-center justify-center bg-transparent border-none cursor-pointer";

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 font-sans text-base-content transition-colors duration-200" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight">Настройки аккаунта</h1>
                <p className="text-base-content/60 font-medium mt-2">Управляйте своими личными данными и безопасностью</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                
                <div className="w-full md:w-64 shrink-0">
                    <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
                        <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' : 'text-base-content/70 hover:bg-base-200 hover:text-base-content border border-transparent'}`}>
                            <User size={20} /> Личные данные
                        </button>
                        <button onClick={() => setActiveTab('security')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'security' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' : 'text-base-content/70 hover:bg-base-200 hover:text-base-content border border-transparent'}`}>
                            <Shield size={20} /> Безопасность
                        </button>
                    </nav>
                </div>

                <div className="flex-1">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>
                    ) : (
                        <div className="bg-base-100 rounded-3xl border border-base-300 shadow-sm overflow-hidden transition-colors duration-200">
                            
                            {/* ПРОФИЛЬ */}
                            {activeTab === 'profile' && (
                                <div className="p-8 animate-in fade-in duration-300">
                                    <h2 className="text-xl font-extrabold mb-6">Личная информация</h2>
                                    {isFakeEmail && (
                                        <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5 flex gap-4 items-start">
                                            <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500 p-2 rounded-xl shrink-0"><AlertTriangle size={24} /></div>
                                            <div>
                                                <h3 className="text-amber-900 dark:text-amber-400 font-bold text-sm">Привяжите реальный Email</h3>
                                                <p className="text-amber-800 dark:text-amber-200/70 text-sm mt-1">Вы вошли через Telegram. Пожалуйста, измените временный email на ваш настоящий для восстановления доступа.</p>
                                            </div>
                                        </div>
                                    )}

                                    <form onSubmit={handleProfileSubmit} className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Имя</label>
                                                <input type="text" value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})} className="w-full px-4 py-3 bg-base-200 border border-base-300 rounded-xl font-medium text-base-content focus:border-blue-500 focus:bg-base-100 outline-none transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Фамилия</label>
                                                <input type="text" value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})} className="w-full px-4 py-3 bg-base-200 border border-base-300 rounded-xl font-medium text-base-content focus:border-blue-500 focus:bg-base-100 outline-none transition-all" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Электронная почта</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/40"><Mail size={18} /></div>
                                                <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className={`w-full pl-11 pr-4 py-3 bg-base-200 border rounded-xl font-medium text-base-content focus:bg-base-100 focus:ring-4 outline-none transition-all ${isFakeEmail ? 'border-amber-300 dark:border-amber-700 focus:border-amber-500 dark:focus:border-amber-500 text-amber-700 dark:text-amber-500' : 'border-base-300 focus:border-blue-500 focus:ring-blue-500/20'}`} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Имя пользователя (Логин)</label>
                                            <input type="text" value={profileData.username} disabled className="w-full px-4 py-3 bg-base-300 border border-base-300 text-base-content/50 rounded-xl font-medium cursor-not-allowed" />
                                        </div>
                                        <div className="pt-4 border-t border-base-200 flex justify-end">
                                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
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
                                        
                                        {/* Исправленная подсказка с контрастным текстом */}
                                        <div className="bg-blue-50 border border-blue-200 text-slate-900 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-base-content text-sm p-4 rounded-xl mb-6 flex gap-3 items-start font-medium transition-colors duration-200">
                                            <Shield className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" size={18} />
                                            <p>Здесь вы можете обновить свой пароль или установить локальный пароль для входа по email, если вы регистрировались через социальные сети.</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Старый пароль (оставьте пустым, если пароля нет)</label>
                                            <div className="relative">
                                                <input type={showOld ? "text" : "password"} value={passwordData.old_password} onChange={e => setPasswordData({...passwordData, old_password: e.target.value})} className={inputClasses} placeholder="••••••••" />
                                                <button type="button" onClick={() => setShowOld(!showOld)} className={eyeBtnClasses}>{showOld ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Новый пароль</label>
                                                <div className="relative">
                                                    <input type={showNew ? "text" : "password"} required minLength={6} value={passwordData.new_password} onChange={e => setPasswordData({...passwordData, new_password: e.target.value})} className={inputClasses} placeholder="Минимум 6 символов" />
                                                    <button type="button" onClick={() => setShowNew(!showNew)} className={eyeBtnClasses}>{showNew ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-base-content/50 uppercase tracking-wider mb-2">Подтвердите новый пароль</label>
                                                <div className="relative">
                                                    <input type={showConfirm ? "text" : "password"} required value={passwordData.confirm_password} onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})} className={inputClasses} placeholder="Повторите пароль" />
                                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={eyeBtnClasses}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Исправленная кнопка */}
                                        <div className="pt-4 border-t border-base-200 flex justify-end">
                                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20 disabled:opacity-70">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-base-100 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-base-200 flex items-center justify-between">
                            <h3 className="font-extrabold text-lg text-base-content">Подтверждение Email</h3>
                            <button onClick={() => { setShowOtpModal(false); setProfileData({...profileData, email: originalEmail}); }} className="p-2 text-base-content/50 hover:bg-base-200 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleVerifyOtp} className="p-6 space-y-6">
                            <p className="text-base-content/80 text-sm">Мы отправили 6-значный код на адрес <strong className="text-base-content">{profileData.email}</strong>. Пожалуйста, введите его ниже для подтверждения смены почты.</p>
                            <div>
                                <input 
                                    type="text" 
                                    maxLength={6}
                                    autoFocus
                                    value={otpCode}
                                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} 
                                    placeholder="123456"
                                    className="w-full text-center tracking-[0.5em] text-2xl font-bold py-4 bg-base-200 border border-base-300 rounded-xl focus:border-blue-500 focus:bg-base-100 focus:ring-4 focus:ring-blue-500/20 text-base-content outline-none transition-all"
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