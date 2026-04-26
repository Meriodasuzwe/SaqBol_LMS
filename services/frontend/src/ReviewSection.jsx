import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Импорт хука перевода
import { Star, Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from './api';

//  Функция для расшифровки JWT токена и получения ID пользователя
const getMyUserId = () => {
    try {
        const token = localStorage.getItem('access'); // Убедись, что токен хранится под ключом 'access'
        if (!token) return null;
        // Расшифровываем payload токена
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id; // В Django SimpleJWT ID лежит в поле user_id
    } catch (e) {
        console.error("Не удалось расшифровать токен:", e);
        return null;
    }
};

export default function ReviewSection({ courseId, isEnrolled, progress }) {
    const { t } = useTranslation(); // ✅ Инициализация
    
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Получаем ID текущего юзера
    const myUserId = getMyUserId();
    // На всякий случай проверяем и username, если он есть
    const localUsername = localStorage.getItem('username');

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const res = await api.get(`courses/${courseId}/reviews/`);
                setReviews(res.data);
            } catch (err) {
                console.error("Ошибка загрузки отзывов", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [courseId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            toast.error(t('reviewSection.toasts.ratingRequired'));
            return;
        }
        if (!text.trim()) {
            toast.error(t('reviewSection.toasts.textRequired'));
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post(`courses/${courseId}/reviews/`, {
                rating: rating,
                text: text
            });
            toast.success(t('reviewSection.toasts.addSuccess'));
            
            // 🔥 Принудительно вешаем флаг is_mine на новый отзыв
            const newReview = { ...res.data, is_mine: true };
            
            setReviews([newReview, ...reviews]);
            setRating(0);
            setText('');
        } catch (err) {
            if (err.response?.data && Array.isArray(err.response.data)) {
                toast.error(err.response.data[0]);
            } else {
                toast.error(t('reviewSection.toasts.addError'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (reviewId) => {
        if (!window.confirm(t('reviewSection.confirmDelete'))) return;
        
        try {
            await api.delete(`courses/reviews/${reviewId}/`);
            toast.success(t('reviewSection.toasts.delSuccess'));
            setReviews(reviews.filter(r => r.id !== reviewId));
        } catch (err) {
            toast.error(t('reviewSection.toasts.delError'));
            console.error("Ошибка удаления:", err);
        }
    };

    // 🔥 Ищем, есть ли в массиве НАШ отзыв
    const hasMyReview = reviews.some(review => 
        review.is_mine || 
        (myUserId && String(review.user) === String(myUserId)) || 
        (localUsername && (review.student_name === localUsername || review.user_name === localUsername))
    );

    if (loading) return <div className="animate-pulse h-24 bg-base-200 rounded-2xl w-full"></div>;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <MessageSquare className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
                <h2 className="text-2xl font-black text-base-content">{t('reviewSection.title')}</h2>
            </div>

            {isEnrolled && !hasMyReview && (
                <div className="bg-base-100 border border-base-300 rounded-2xl p-6 shadow-sm mb-10 transition-all">
                    {progress >= 20 ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <h3 className="font-bold text-base-content mb-4">{t('reviewSection.leaveReview')}</h3>
                            
                            <div className="flex items-center gap-2 mb-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        className="focus:outline-none transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={28}
                                            className={`transition-colors ${
                                                star <= (hoverRating || rating)
                                                    ? "fill-amber-400 text-amber-400"
                                                    : "text-base-300"
                                            }`}
                                        />
                                    </button>
                                ))}
                                <span className="ml-3 text-sm font-bold text-base-content/50">
                                    {rating > 0 ? `${rating} ${t('reviewSection.outOf5')}` : t('reviewSection.selectRating')}
                                </span>
                            </div>

                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={t('reviewSection.placeholder')}
                                className="w-full bg-base-200 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-600 min-h-[120px] resize-none"
                                required
                            />
                            
                            <button 
                                type="submit" 
                                disabled={submitting || rating === 0 || !text.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {submitting ? t('reviewSection.submitting') : t('reviewSection.submitBtn')}
                            </button>
                        </form>
                    ) : (
                        <div className="flex items-center gap-4 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 p-4 rounded-xl">
                            <AlertCircle size={24} />
                            <p className="text-sm font-bold">{t('reviewSection.restriction')}</p>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <p className="text-base-content/50 italic text-sm">{t('reviewSection.empty')}</p>
                ) : (
                    reviews.map((review) => {
                        // 🔥 Главная логика проверки "свой/чужой"
                        const isMine = review.is_mine || 
                                       (myUserId && String(review.user) === String(myUserId)) || 
                                       (localUsername && (review.student_name === localUsername || review.user_name === localUsername));

                        return (
                            <div 
                                key={review.id} 
                                className={`p-6 rounded-2xl border transition-all ${
                                    isMine 
                                    ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm' 
                                    : 'bg-base-100 border-base-200'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center font-bold text-base-content/60 uppercase">
                                            {(review.student_name || review.user_name || 'С')[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-base-content flex items-center gap-2">
                                                {review.student_name || review.user_name || `${t('reviewSection.studentFallback')}${review.user || t('reviewSection.anonymous')}`}
                                                {isMine && (
                                                    <span className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                                                        {t('reviewSection.yourReview')}
                                                    </span>
                                                )}
                                            </p>
                                            <div className="flex items-center gap-1 mt-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star 
                                                        key={i} 
                                                        size={12} 
                                                        className={i < review.rating ? "fill-amber-400 text-amber-400" : "text-base-300"} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* КНОПКА УДАЛЕНИЯ */}
                                    {isMine && (
                                        <button 
                                            onClick={() => handleDelete(review.id)}
                                            className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-3 py-2 rounded-lg transition-all cursor-pointer border border-red-100 dark:border-red-900/50"
                                        >
                                            <Trash2 size={16} />
                                            {t('reviewSection.delete')}
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-base-content/80 leading-relaxed ml-14">
                                    {review.text}
                                </p>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}