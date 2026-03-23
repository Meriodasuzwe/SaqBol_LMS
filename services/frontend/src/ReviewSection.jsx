import React, { useState, useEffect } from 'react';
import { Star, Send, User, Lock } from 'lucide-react';
import api from './api'; 
import { toast } from 'react-toastify';

const ReviewSection = ({ courseId, isEnrolled, progress }) => {
    const [reviews, setReviews] = useState([]);
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    // Достаем роль из LocalStorage, чтобы дать админам VIP-доступ
    const userRole = localStorage.getItem('userRole');
    const isVIP = userRole === 'admin' || userRole === 'teacher';

    const MIN_PROGRESS_REQUIRED = 20;
    // Админы/учителя могут писать всегда. Студенты — только если записаны и прошли 20%
    const canReview = isVIP || (isEnrolled && progress >= MIN_PROGRESS_REQUIRED);

    useEffect(() => {
        fetchReviews();
    }, [courseId]);

    const fetchReviews = async () => {
        try {
            const res = await api.get(`/courses/${courseId}/reviews/`);
            setReviews(res.data);
        } catch (err) {
            console.error("Ошибка загрузки отзывов", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            toast.warning("Пожалуйста, поставьте оценку от 1 до 5 звезд!");
            return;
        }

        setLoading(true);
        try {
            await api.post(`/courses/${courseId}/reviews/`, {
                rating: rating,
                text: text
            });
            toast.success("Спасибо за ваш отзыв!");
            setRating(0);
            setText('');
            fetchReviews();
        } catch (err) {
            if (err.response?.data?.length > 0) {
                toast.error(err.response.data[0]); 
            } else {
                toast.error("Ошибка при отправке отзыва.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-12 pt-8 border-t border-base-200">
            <h2 className="text-2xl font-extrabold text-base-content mb-6 flex items-center gap-2">
                <Star className="text-amber-500 fill-amber-500" />
                Отзывы ({reviews.length})
            </h2>

            {/* Форма или Блокировка */}
            <div className="bg-base-200 rounded-2xl p-6 mb-8 relative overflow-hidden">
                {!canReview ? (
                    <div className="flex flex-col items-center justify-center text-center py-6">
                        <div className="w-12 h-12 bg-base-300 rounded-full flex items-center justify-center mb-3">
                            <Lock className="text-base-content/50" size={20} />
                        </div>
                        <h3 className="font-bold text-base-content mb-2">Отзыв пока недоступен</h3>
                        {!isEnrolled ? (
                            <p className="text-sm text-base-content/60">Запишитесь на курс, чтобы поделиться впечатлениями.</p>
                        ) : (
                            <div className="w-full max-w-sm">
                                <p className="text-sm text-base-content/60 mb-3">
                                    Вы прошли {progress}%. Для объективной оценки нужно пройти минимум {MIN_PROGRESS_REQUIRED}% курса.
                                </p>
                                <div className="h-2 bg-base-300 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((progress / MIN_PROGRESS_REQUIRED) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <h3 className="font-bold text-base-content mb-4">Оставить отзыв</h3>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        type="button"
                                        key={star}
                                        className="focus:outline-none transition-transform hover:scale-110"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHover(star)}
                                        onMouseLeave={() => setHover(rating)}
                                    >
                                        <Star 
                                            size={28} 
                                            className={`${star <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-base-content/20"}`}
                                        />
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Что вам понравилось? Что можно улучшить?"
                                className="w-full p-4 rounded-xl bg-base-100 border border-base-300 focus:border-blue-500 outline-none resize-none min-h-[100px] text-sm"
                            />
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="self-end flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                <Send size={16} /> {loading ? "Отправка..." : "Отправить отзыв"}
                            </button>
                        </form>
                    </>
                )}
            </div>

            {/* Список отзывов */}
            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <p className="text-base-content/50 italic text-sm">Отзывов пока нет. Будьте первым!</p>
                ) : (
                    reviews.map((rev) => (
                        <div key={rev.id} className="bg-base-100 border border-base-200 p-5 rounded-2xl flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                                {rev.user_name ? rev.user_name[0].toUpperCase() : <User size={20}/>}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-bold text-base-content text-sm">{rev.user_name}</span>
                                    <span className="text-xs text-base-content/40">
                                        {new Date(rev.created_at).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                                <div className="flex gap-0.5 mb-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Star key={star} size={12} className={star <= rev.rating ? "fill-amber-400 text-amber-400" : "text-base-content/20"} />
                                    ))}
                                </div>
                                <p className="text-sm text-base-content/80 leading-relaxed">
                                    {rev.text || <span className="italic text-base-content/40">Без текста</span>}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ReviewSection;