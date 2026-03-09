import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import { 
    Search, 
    Image as ImageIcon,
    ArrowRight,
    PlayCircle
} from 'lucide-react';

// Функция для очистки текста от HTML-тегов (чтобы в карточках не было <p> и <a>)
const stripHtml = (html) => {
    if (!html) return "Описание курса скоро будет добавлено.";
    return html.replace(/<[^>]+>/g, '');
};

function CourseList() {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]); 
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");

    useEffect(() => {
        api.get('courses/categories/')
            .then(res => setCategories(res.data))
            .catch(err => console.error("Ошибка загрузки категорий", err));
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (selectedCategory) params.append('category', selectedCategory);

        api.get(`courses/?${params.toString()}`)
            .then(response => {
                setCourses(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Ошибка загрузки курсов:", error);
                setLoading(false);
            });
    }, [searchTerm, selectedCategory]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            
            {/* СТРОГИЙ ЧЕРНЫЙ БАННЕР */}
            <div className="bg-slate-900 text-white pt-16 pb-24 px-6 rounded-b-[3rem] shadow-sm mb-[-3rem]">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                        Каталог знаний
                    </h1>
                    <p className="text-slate-400 font-medium max-w-xl text-lg mb-10">
                        Осваивайте новые навыки с помощью структурированных материалов и интерактивных тренажеров.
                    </p>

                    <div className="flex flex-col md:flex-row gap-3 max-w-3xl">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search size={18} className="text-slate-400" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Поиск по курсам..." 
                                className="w-full pl-11 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-slate-400 font-medium focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 outline-none transition-all backdrop-blur-md"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="w-full md:w-64 px-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white font-medium focus:bg-white focus:text-slate-900 outline-none appearance-none cursor-pointer transition-all backdrop-blur-md"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="" className="text-slate-900">Все направления</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id} className="text-slate-900">{cat.title}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10 pt-4">
                {loading ? (
                    <div className="flex items-center justify-center min-h-[40vh]">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {courses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {courses.map(course => {
                                    // Проверяем все возможные поля с картинкой
                                    const imageUrl = course.image || course.cover_image || course.image_url;
                                    
                                    return (
                                    <Link 
                                        to={`/courses/${course.id}`} 
                                        key={course.id} 
                                        className="group flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
                                    >
                                        <div className="relative w-full aspect-video bg-slate-900 overflow-hidden border-b border-slate-100 flex items-center justify-center">
                                            {imageUrl ? (
                                                <img 
                                                    src={imageUrl} 
                                                    alt={course.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-700">
                                                    <ImageIcon size={48} strokeWidth={1} className="mb-2 opacity-50" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Обложка отсутствует</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        </div>

                                        <div className="p-6 sm:p-8 flex-1 flex flex-col">
                                            {course.category_title && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">
                                                    {course.category_title}
                                                </span>
                                            )}
                                            <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight">
                                                {course.title}
                                            </h3>
                                            
                                            {/* 🔥 ЗДЕСЬ ИСПОЛЬЗУЕТСЯ ФУНКЦИЯ ОЧИСТКИ HTML 🔥 */}
                                            <p className="text-sm text-slate-500 line-clamp-2 mb-6 font-medium">
                                                {stripHtml(course.description)}
                                            </p>

                                            <div className="mt-auto">
                                                {course.progress > 0 && (
                                                    <div className="mb-6">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Прогресс</span>
                                                            <span className="text-xs font-black text-slate-900">{course.progress}%</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${course.progress}%` }}></div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Доступ</p>
                                                        <p className="text-sm font-black text-slate-900">
                                                            {parseFloat(course.price) > 0 ? `${new Intl.NumberFormat('ru-RU').format(course.price)} ₸` : 'Бесплатно'}
                                                        </p>
                                                    </div>
                                                    
                                                    <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all
                                                        ${course.progress > 0 ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900 border border-slate-200 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900'}`}
                                                    >
                                                        {course.progress > 0 ? 'Продолжить' : 'Открыть'}
                                                        {course.progress > 0 ? <PlayCircle size={14} /> : <ArrowRight size={14} />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )})}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Search size={40} className="text-slate-300 mb-4" />
                                <h3 className="text-xl font-black text-slate-900 mb-2">Ничего не найдено</h3>
                                <p className="text-sm text-slate-500">Попробуйте изменить поисковой запрос.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default CourseList;