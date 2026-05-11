import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    BarChart3, Users, ShieldCheck, Search, 
    ChevronLeft, Activity, Target, Eye, Clock, CheckCircle2,
    Trash2, AlertTriangle, XCircle 
} from 'lucide-react';
import api from './api'; 
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next'; // Импортируем хук

const CorporateDashboard = () => {
    const navigate = useNavigate();
    const { t } = useTranslation(); // Инициализируем переводы
    
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    
    const [revokeConfirmData, setRevokeConfirmData] = useState(null);
    const [isRevoking, setIsRevoking] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await api.get('courses/b2b/dashboard/');
                if (res.data.message) {
                    setData([]);
                } else {
                    setData(res.data);
                }
            } catch (error) {
                console.error("Ошибка загрузки дашборда", error);
                toast.error(t('corpDashboard.analyticsLoadError'));
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, [t]); // Добавили t в зависимости

    const handleRevokeClick = (inviteCode, employee) => {
        setRevokeConfirmData({ inviteCode, employee });
    };

    const executeRevokeAccess = async () => {
        if (!revokeConfirmData) return;
        setIsRevoking(true);
        try {
            const { inviteCode, employee } = revokeConfirmData;
            
            await api.post(`courses/b2b/invites/${inviteCode}/revoke/${employee.id}/`);
            
            setData(prevData => prevData.map(lead => {
                if (lead.invite_code === inviteCode) {
                    return {
                        ...lead,
                        used_places: Math.max(0, lead.used_places - 1),
                        employees: lead.employees.filter(emp => emp.id !== employee.id)
                    };
                }
                return lead;
            }));

            toast.success(t('corpDashboard.accessRevoked'));
            setRevokeConfirmData(null); 
        } catch (error) {
            toast.error(error.response?.data?.error || t('corpDashboard.revokeError'));
        } finally {
            setIsRevoking(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="min-h-screen bg-base-200 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-base-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                    <ShieldCheck size={40} className="text-base-content/20" />
                </div>
                <h2 className="text-2xl font-black mb-2">{t('corpDashboard.title')}</h2>
                <p className="text-base-content/60 max-w-md">{t('corpDashboard.noActiveRequests')}</p>
                <button onClick={() => navigate('/corporate')} className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">
                    {t('corpDashboard.chooseTraining')}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-200 pb-20 font-sans text-base-content transition-colors duration-200">
            <div className="bg-base-100 border-b border-base-300 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/profile')} className="p-2 hover:bg-base-200 rounded-xl transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-black">{t('corpDashboard.title')}</h1>
                            <p className="text-xs text-base-content/50 uppercase tracking-widest font-bold">{t('corpDashboard.subtitle')}</p>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl text-sm font-bold border border-indigo-100 dark:border-indigo-800/50">
                        <Activity size={16} /> Live Data
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
                {data.map((lead, index) => (
                    <div key={lead.id} className="bg-base-100 rounded-[2rem] p-8 border border-base-300 shadow-sm">
                        
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest mb-3">
                                    <Target size={12} /> {lead.company}
                                </div>
                                <h2 className="text-2xl font-black mb-1">{lead.course_title}</h2>
                                <p className="text-xs text-base-content/50">
                                    {t('corpDashboard.requestFrom')} {new Date(lead.created_at).toLocaleDateString()}
                                </p>
                            </div>

                            {lead.status === 'rejected' ? (
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800">
                                    <XCircle size={18} />
                                    <span className="font-bold text-sm">{t('corpDashboard.statusRejected')}</span>
                                </div>
                            ) : lead.invite_code ? (
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 size={18} />
                                    <span className="font-bold text-sm">{t('corpDashboard.statusOpen')}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800">
                                    <Clock size={18} />
                                    <span className="font-bold text-sm">{t('corpDashboard.statusPending')}</span>
                                </div>
                            )}
                        </div>

                        {lead.status === 'rejected' ? (
                            <div className="pt-6 border-t border-base-200 text-center py-8">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <XCircle size={32} />
                                </div>
                                <h3 className="font-bold text-lg mb-2 text-base-content">{t('corpDashboard.rejectedTitle')}</h3>
                                <p className="text-base-content/60 text-sm max-w-md mx-auto">
                                    {t('corpDashboard.rejectedDesc')}
                                </p>
                            </div>
                        ) : lead.invite_code ? (
                            <>
                                <div className="flex flex-wrap gap-4 mb-8 pt-6 border-t border-base-200">
                                    <div className="bg-base-200/50 p-4 rounded-2xl border border-base-200 flex-1 min-w-[200px]">
                                        <p className="text-[10px] uppercase font-black text-base-content/50 tracking-widest mb-1">{t('corpDashboard.accessCode')}</p>
                                        <div className="text-xl font-mono font-bold text-base-content">{lead.invite_code}</div>
                                    </div>
                                    <div className="bg-base-200/50 p-4 rounded-2xl border border-base-200 flex-1 min-w-[150px]">
                                        <p className="text-[10px] uppercase font-black text-base-content/50 tracking-widest mb-1">{t('corpDashboard.usedPlaces')}</p>
                                        <div className="text-xl font-black text-indigo-600">
                                            {lead.used_places} <span className="text-sm text-base-content/30">/ {lead.total_places}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Users size={18} className="text-base-content/50" /> {t('corpDashboard.employeeStats')}
                                    </h3>
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder={t('corpDashboard.searchPlaceholder')}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-base-200/50 border border-base-300 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-[10px] uppercase font-black text-base-content/40 tracking-widest bg-base-200/50">
                                            <tr>
                                                <th className="px-6 py-4 rounded-l-xl">{t('corpDashboard.colEmployee')}</th>
                                                <th className="px-6 py-4">{t('corpDashboard.colProgress')}</th>
                                                <th className="px-6 py-4">{t('corpDashboard.colStatus')}</th>
                                                <th className="px-6 py-4 rounded-r-xl text-right">{t('corpDashboard.colActions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lead.employees
                                                .filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                .map((emp) => (
                                                <tr key={emp.id} className="border-b border-base-200/50 hover:bg-base-200/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-base-content">{emp.name}</p>
                                                        <p className="text-xs text-base-content/50">{emp.email}</p>
                                                    </td>
                                                    <td className="px-6 py-4 w-1/3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold w-10">{emp.progress}%</span>
                                                            <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full bg-${emp.color}-500`} 
                                                                    style={{ width: `${emp.progress}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold bg-${emp.color}-100 text-${emp.color}-600 dark:bg-${emp.color}-900/30 dark:text-${emp.color}-400`}>
                                                            {emp.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                                onClick={() => setSelectedEmployee(emp)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-base-300 hover:border-indigo-500 hover:text-indigo-600 transition-colors text-xs font-bold text-base-content/70"
                                                                title={t('corpDashboard.actionAnalyze')}
                                                            >
                                                                <Eye size={14} /> {t('corpDashboard.btnAnalyze')}
                                                            </button>
                                                            <button 
                                                                onClick={() => handleRevokeClick(lead.invite_code, emp)}
                                                                className="p-1.5 rounded-lg border border-base-300 hover:border-red-500 hover:bg-red-50 text-base-content/50 hover:text-red-500 transition-all"
                                                                title={t('corpDashboard.actionRevoke')}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {lead.employees.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-12 text-center text-base-content/40 font-medium">
                                                        {t('corpDashboard.noEmployees')}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="pt-6 border-t border-base-200 text-center py-8">
                                <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Clock className="text-base-content/30" size={32} />
                                </div>
                                <h3 className="font-bold text-lg mb-2">{t('corpDashboard.pendingTitle')}</h3>
                                <p className="text-base-content/60 text-sm max-w-md mx-auto">
                                    {t('corpDashboard.pendingDesc')}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {revokeConfirmData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-base-content/60 backdrop-blur-sm" onClick={() => !isRevoking && setRevokeConfirmData(null)}></div>
                    <div className="bg-base-100 rounded-[2rem] p-8 w-full max-w-md relative z-10 shadow-2xl border border-base-300 animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-2xl font-black mb-2 text-center text-base-content">{t('corpDashboard.revokeModalTitle')}</h3>
                        <p className="text-center text-base-content/70 mb-8 text-sm">
                            {t('corpDashboard.revokeModalDesc1')} <span className="font-bold">{revokeConfirmData.employee.name}</span>. 
                            {t('corpDashboard.revokeModalDesc2')}
                            <br/><br/>
                            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md font-bold text-xs">
                                {t('corpDashboard.revokeModalBonus')}
                            </span>
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setRevokeConfirmData(null)} 
                                disabled={isRevoking}
                                className="flex-1 bg-base-200 hover:bg-base-300 text-base-content py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                            >
                                {t('corpDashboard.btnCancel')}
                            </button>
                            <button 
                                onClick={executeRevokeAccess} 
                                disabled={isRevoking}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isRevoking ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : t('corpDashboard.btnRevokeConfirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-base-content/40 backdrop-blur-sm" onClick={() => setSelectedEmployee(null)}></div>
                    <div className="bg-base-100 rounded-[2rem] p-8 w-full max-w-2xl relative z-10 shadow-2xl border border-base-300 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-start mb-6 shrink-0">
                            <div>
                                <h3 className="text-2xl font-black mb-1">{selectedEmployee.name}</h3>
                                <p className="text-sm text-base-content/50">{selectedEmployee.email}</p>
                            </div>
                            <button onClick={() => setSelectedEmployee(null)} className="p-2 bg-base-200 hover:bg-base-300 rounded-xl transition-colors">
                                ✕
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-8 shrink-0">
                            <div className="bg-base-200/50 p-4 rounded-xl border border-base-200">
                                <p className="text-[10px] uppercase font-black text-base-content/50 tracking-widest mb-1">{t('corpDashboard.currentProgress')}</p>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xl font-black text-${selectedEmployee.color}-500`}>{selectedEmployee.progress}%</span>
                                    <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden flex-1">
                                        <div className={`h-full bg-${selectedEmployee.color}-500`} style={{ width: `${selectedEmployee.progress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-base-200/50 p-4 rounded-xl border border-base-200">
                                <p className="text-[10px] uppercase font-black text-base-content/50 tracking-widest mb-1">{t('corpDashboard.learningStatus')}</p>
                                <span className={`text-xl font-black text-${selectedEmployee.color}-500`}>{selectedEmployee.status}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                                <BarChart3 size={16} className="text-indigo-500" />
                                {t('corpDashboard.testResults')}
                            </h4>
                            
                            {selectedEmployee.tests && selectedEmployee.tests.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedEmployee.tests.map((test) => (
                                        <div key={test.id} className="flex items-center justify-between p-4 rounded-xl border border-base-200 bg-base-50/50 hover:bg-base-100 transition-colors">
                                            <div>
                                                <p className="font-bold text-sm text-base-content mb-1">{test.title}</p>
                                                <p className="text-[10px] text-base-content/50 uppercase tracking-widest font-bold">
                                                    {t('corpDashboard.passedDate')} {test.date || t('corpDashboard.unknown')}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className={`text-lg font-black ${test.passed ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {test.score}%
                                                    </p>
                                                </div>
                                                <div className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                                                    test.passed 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800' 
                                                    : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800'
                                                }`}>
                                                    {test.passed ? t('corpDashboard.passed') : t('corpDashboard.failed')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-base-200/30 rounded-xl border border-dashed border-base-300">
                                    <p className="text-sm text-base-content/50 font-medium">{t('corpDashboard.noTests')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CorporateDashboard;