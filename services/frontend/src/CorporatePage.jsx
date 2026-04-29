import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { 
    ShieldCheck, BarChart3, Users,User, Mail, 
    ArrowRight, ChevronLeft, CheckCircle2, 
    Building2, Briefcase, Activity
} from 'lucide-react';
import api from './api';

const CorporatePage = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
        name: '',
        company: '',
        email: '',
        employees: '10-50'
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Скролл наверх при загрузке
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            //  Отправляем данные на бэкенд
            await api.post('courses/b2b/leads/create/', formData);
            
            setLoading(false);
            setSuccess(true);
        } catch (error) {
            setLoading(false);
            toast.error("Ошибка при отправке заявки. Попробуйте позже.");
        }
    };

    return (
        <div className="min-h-screen bg-base-200 font-sans text-base-content transition-colors duration-200 pb-24">
            
            {/* Навигация */}
            <div className="max-w-7xl mx-auto px-6 pt-8 mb-8">
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-base-content/50 hover:text-base-content transition-colors group"
                >
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Назад
                </button>
            </div>

            <div className="max-w-7xl mx-auto px-6">
                
                {/* ── HERO СЕКЦИЯ ── */}
                <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-6 border border-indigo-200 dark:border-indigo-800/50">
                            <Briefcase size={14} /> B2B Решения
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6">
                            Защитите бизнес от <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-600">человеческого фактора</span>
                        </h1>
                        <p className="text-lg text-base-content/70 leading-relaxed mb-8 max-w-lg">
                            Превратите ваших сотрудников из главного вектора атак в надежный щит компании. Обучение, симуляции фишинга и глубокая аналитика в едином дашборде.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => document.getElementById('lead-form').scrollIntoView({ behavior: 'smooth' })}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                            >
                                Получить демо-доступ <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>

                    {/* 🔥 ФЕЙКОВЫЙ ДАШБОРД (MOCKUP) 🔥 */}
                    <div className="relative animate-in fade-in zoom-in-95 duration-1000 delay-150 hidden md:block">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-blue-500/20 blur-3xl rounded-full transform -translate-y-10 -z-10"></div>
                        <div className="bg-base-100 border border-base-300 rounded-[2rem] shadow-2xl p-6 relative overflow-hidden">
                            {/* Шапка мокапа */}
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-base-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                                        <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm">Аналитика отдела</h3>
                                        <p className="text-[10px] text-base-content/50 uppercase tracking-widest font-bold">Октябрь 2026</p>
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1.5">
                                    <Activity size={14} /> Угрозы снижены
                                </div>
                            </div>
                            
                            {/* Графики мокапа */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-base-200/50 p-4 rounded-2xl border border-base-200">
                                    <p className="text-[10px] uppercase font-black text-base-content/50 tracking-widest mb-1">Попались на фишинг</p>
                                    <div className="flex items-end gap-2">
                                        <span className="text-2xl font-black text-red-500">12%</span>
                                        <span className="text-xs text-emerald-500 font-bold mb-1">▼ -8%</span>
                                    </div>
                                </div>
                                <div className="bg-base-200/50 p-4 rounded-2xl border border-base-200">
                                    <p className="text-[10px] uppercase font-black text-base-content/50 tracking-widest mb-1">Уровень защиты</p>
                                    <div className="flex items-end gap-2">
                                        <span className="text-2xl font-black text-emerald-500">88%</span>
                                        <span className="text-xs text-emerald-500 font-bold mb-1">▲ +14%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Список сотрудников мокап */}
                            <div className="space-y-3">
                                {[
                                    { name: "Айдос Н.", dep: "Бухгалтерия", progress: 100, status: "Защищен", color: "emerald" },
                                    { name: "Мария К.", dep: "Маркетинг", progress: 65, status: "В процессе", color: "blue" },
                                    { name: "Ерлан Б.", dep: "IT Отдел", progress: 30, status: "Уязвим", color: "red" },
                                ].map((emp, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-base-100 border border-base-200 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-${emp.color}-100 text-${emp.color}-600 dark:bg-${emp.color}-900/30 dark:text-${emp.color}-400`}>
                                                {emp.name[0]}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">{emp.name}</p>
                                                <p className="text-[9px] text-base-content/50 uppercase tracking-wider">{emp.dep}</p>
                                            </div>
                                        </div>
                                        <div className="w-24">
                                            <div className="h-1.5 w-full bg-base-200 rounded-full overflow-hidden mb-1">
                                                <div className={`h-full bg-${emp.color}-500`} style={{ width: `${emp.progress}%` }}></div>
                                            </div>
                                            <p className={`text-[9px] text-right font-bold text-${emp.color}-500`}>{emp.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── ПРЕИМУЩЕСТВА (FEATURES) ── */}
                <div className="grid md:grid-cols-3 gap-6 mb-24">
                    <div className="bg-base-100 p-8 rounded-[2rem] border border-base-300 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-800">
                            <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={24} />
                        </div>
                        <h3 className="text-lg font-black mb-3">Дашборд руководителя</h3>
                        <p className="text-sm text-base-content/70 leading-relaxed">
                            Отслеживайте прогресс каждого сотрудника в реальном времени. Находите уязвимые отделы и назначайте повторные симуляции.
                        </p>
                    </div>
                    <div className="bg-base-100 p-8 rounded-[2rem] border border-base-300 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 dark:border-emerald-800">
                            <ShieldCheck className="text-emerald-600 dark:text-emerald-400" size={24} />
                        </div>
                        <h3 className="text-lg font-black mb-3">Реальные симуляции</h3>
                        <p className="text-sm text-base-content/70 leading-relaxed">
                            Тестируйте команду безопасными фишинговыми рассылками и атаками в мессенджерах на базе AI, чтобы выработать рефлекс.
                        </p>
                    </div>
                    <div className="bg-base-100 p-8 rounded-[2rem] border border-base-300 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 dark:border-blue-800">
                            <Users className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <h3 className="text-lg font-black mb-3">Управление доступом</h3>
                        <p className="text-sm text-base-content/70 leading-relaxed">
                            Легко импортируйте списки сотрудников, делите их на группы и в один клик рассылайте приглашения на обучение.
                        </p>
                    </div>
                </div>

                {/* ── ФОРМА ЗАЯВКИ ── */}
                <div id="lead-form" className="max-w-2xl mx-auto scroll-mt-24">
                    <div className="bg-base-100 rounded-[2.5rem] p-8 md:p-12 border border-base-300 shadow-xl shadow-base-300/20 relative overflow-hidden">
                        
                        {/* Декор */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                        {success ? (
                            <div className="text-center py-12 animate-in zoom-in duration-500">
                                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
                                    <CheckCircle2 size={48} />
                                </div>
                                <h2 className="text-2xl font-black mb-4">Заявка принята!</h2>
                                <p className="text-base-content/70 mb-8 max-w-sm mx-auto">
                                    Наш менеджер свяжется с вами в течение часа, чтобы обсудить детали и открыть демо-доступ.
                                </p>
                                <button 
                                    onClick={() => navigate('/')}
                                    className="bg-base-200 hover:bg-base-300 text-base-content px-8 py-3 rounded-xl font-bold transition-colors"
                                >
                                    Вернуться на главную
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-10 relative z-10">
                                    <h2 className="text-3xl font-black tracking-tight mb-3">Начать обучение команды</h2>
                                    <p className="text-sm text-base-content/60">Оставьте заявку, и мы настроим платформу под нужды вашей компании.</p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 ml-1">Как к вам обращаться?</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={18} />
                                                <input 
                                                    required type="text" name="name" value={formData.name} onChange={handleChange}
                                                    placeholder="Иван Иванов" 
                                                    className="w-full pl-12 pr-4 py-3.5 bg-base-200/50 border border-base-300 focus:border-indigo-500 focus:bg-base-100 rounded-xl text-sm font-medium outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 ml-1">Компания</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={18} />
                                                <input 
                                                    required type="text" name="company" value={formData.company} onChange={handleChange}
                                                    placeholder="Название ООО/ТОО" 
                                                    className="w-full pl-12 pr-4 py-3.5 bg-base-200/50 border border-base-300 focus:border-indigo-500 focus:bg-base-100 rounded-xl text-sm font-medium outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 ml-1">Рабочий Email</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={18} />
                                                <input 
                                                    required type="email" name="email" value={formData.email} onChange={handleChange}
                                                    placeholder="work@company.com" 
                                                    className="w-full pl-12 pr-4 py-3.5 bg-base-200/50 border border-base-300 focus:border-indigo-500 focus:bg-base-100 rounded-xl text-sm font-medium outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 ml-1">Штат сотрудников</label>
                                            <div className="relative">
                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={18} />
                                                <select 
                                                    name="employees" value={formData.employees} onChange={handleChange}
                                                    className="w-full pl-12 pr-4 py-3.5 bg-base-200/50 border border-base-300 focus:border-indigo-500 focus:bg-base-100 rounded-xl text-sm font-medium outline-none transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="1-10">До 10 человек</option>
                                                    <option value="10-50">10 — 50 человек</option>
                                                    <option value="50-200">50 — 200 человек</option>
                                                    <option value="200+">Более 200 человек</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            "Оставить заявку"
                                        )}
                                    </button>
                                    <p className="text-center text-[10px] text-base-content/40 mt-4 font-medium">
                                        Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности.
                                    </p>
                                </form>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CorporatePage;