import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useState } from 'react';

// Импорты страниц
import Login from './Login';
import CourseList from './CourseList';
import CourseDetail from './CourseDetail';
import QuizPage from './QuizPage';
import Profile from './Profile';
import LessonPage from './LessonPage';
import TeacherPanel from './TeacherPanel';
import CourseBuilder from './CourseBuilder'; // <-- Убедись, что файл CourseBuilder.jsx существует в папке src

function App() {
  // Проверяем наличие токена в localStorage для сохранения сессии
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access'));

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <div className="min-h-screen bg-base-100 font-sans text-base-content flex flex-col">
        
        {/* --- ШАПКА САЙТА (NAVBAR) --- */}
        {/* Добавили container mx-auto внутрь navbar, чтобы контент не прилипал к краям */}
        <header className="bg-base-100 shadow-sm border-b border-base-200 sticky top-0 z-50">
          <div className="navbar container mx-auto px-4 lg:px-8">
            <div className="flex-1">
              <Link to="/" className="btn btn-ghost text-xl font-bold text-primary tracking-tighter hover:bg-transparent">
                SaqBol <span className="text-secondary font-black">LMS</span>
              </Link>
            </div>
            
            <div className="flex-none gap-3">
              {isLoggedIn ? (
                <>
                  <Link to="/courses" className="btn btn-ghost btn-sm">Курсы</Link>
                  
                  {/* Ссылка на общую AI Лабораторию (можно скрыть на моб. устройствах) */}
                  <Link to="/teacher" className="btn btn-ghost btn-sm text-secondary hidden md:flex">
                    AI Лаборатория
                  </Link>

                  <Link to="/profile" className="btn btn-ghost btn-sm">Профиль</Link>
                  
                  <div className="divider divider-horizontal mx-1 h-6 self-center"></div>
                  
                  <button 
                    onClick={handleLogout} 
                    className="btn btn-sm btn-outline btn-error"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm px-6">Войти</Link>
              )}
            </div>
          </div>
        </header>

        {/* --- ОСНОВНОЙ КОНТЕНТ --- */}
        <main className="container mx-auto p-4 lg:p-8 flex-grow">
          <Routes>
            
            {/* 1. АВТОРИЗАЦИЯ */}
            <Route path="/login" element={
              !isLoggedIn ? <Login onLoginSuccess={() => setIsLoggedIn(true)} /> : <Navigate to="/courses" />
            } />

            {/* 2. СТУДЕНЧЕСКИЙ ИНТЕРФЕЙС */}
            <Route path="/courses" element={
              isLoggedIn ? <CourseList /> : <Navigate to="/login" />
            } />
            
            <Route path="/courses/:id" element={
              isLoggedIn ? <CourseDetail /> : <Navigate to="/login" />
            } />
            
            <Route path="/lesson/:lessonId" element={
              isLoggedIn ? <LessonPage /> : <Navigate to="/login" />
            } />

            <Route path="/quiz/lesson/:lessonId" element={
              isLoggedIn ? <QuizPage /> : <Navigate to="/login" />
            } />

            <Route path="/profile" element={
              isLoggedIn ? <Profile /> : <Navigate to="/login" />
            } />

            {/* 3. ИНТЕРФЕЙС УЧИТЕЛЯ (AI & BUILDER) */}
            
            {/* Гибридный конструктор курса (Теория + AI Тесты) */}
            <Route path="/teacher/course/:courseId/builder" element={
              isLoggedIn ? <CourseBuilder /> : <Navigate to="/login" />
            } />

            {/* Общая панель генерации тестов */}
            <Route path="/teacher" element={
              isLoggedIn ? <TeacherPanel /> : <Navigate to="/login" />
            } />

            {/* --- РЕДИРЕКТЫ --- */}
            <Route path="/" element={<Navigate to={isLoggedIn ? "/courses" : "/login"} />} />
            <Route path="*" element={<Navigate to="/" />} />

          </Routes>
        </main>

        {/* --- ПОДВАЛ (FOOTER) --- */}
        <footer className="footer footer-center p-4 bg-base-200 text-base-content mt-auto">
          <div>
            <p>© 2026 SaqBol LMS - AI Education Platform</p>
          </div>
        </footer>

      </div>
    </Router>
  );
}

export default App;