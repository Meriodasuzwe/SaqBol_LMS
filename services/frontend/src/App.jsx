import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './Login';
import CourseList from './CourseList';
import CourseDetail from './CourseDetail';
import QuizPage from './QuizPage';
import Profile from './Profile';
import LessonPage from './LessonPage';
import TeacherPanel from './TeacherPanel'; // <-- Импорт новой панели

function App() {
  // Проверяем токен при загрузке, чтобы не выбивало при F5
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access'));

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <div className="min-h-screen bg-base-100 font-sans text-base-content">
        {/* Шапка (Navbar) */}
        <header className="navbar bg-base-100 shadow-sm border-b border-base-200 sticky top-0 z-50 px-4 lg:px-8">
          <div className="flex-1">
            <Link to="/" className="btn btn-ghost text-xl font-bold text-primary">SaqBol Platform</Link>
          </div>
          
          <div className="flex-none gap-4">
            {isLoggedIn && (
              <>
                <Link to="/courses" className="btn btn-ghost btn-sm">Курсы</Link>
                <Link to="/profile" className="btn btn-ghost btn-sm">Профиль</Link>
                <button 
                  onClick={handleLogout} 
                  className="btn btn-error btn-sm text-white"
                >
                  Выйти
                </button>
              </>
            )}
          </div>
        </header>

        {/* Основной контент */}
        <main className="container mx-auto p-4 lg:p-8">
          <Routes>
            {/* 1. Логин */}
            <Route path="/login" element={
              !isLoggedIn ? <Login onLoginSuccess={() => setIsLoggedIn(true)} /> : <Navigate to="/courses" />
            } />

            {/* 2. Список курсов */}
            <Route path="/courses" element={
              isLoggedIn ? <CourseList /> : <Navigate to="/login" />
            } />
            
            {/* 3. Детали курса */}
            <Route path="/courses/:id" element={
              isLoggedIn ? <CourseDetail /> : <Navigate to="/login" />
            } />
            
            {/* 4. Страница УРОКА (Теория + Видео) */}
            <Route path="/lesson/:lessonId" element={
              isLoggedIn ? <LessonPage /> : <Navigate to="/login" />
            } />

            {/* 5. Страница ТЕСТА */}
            <Route path="/quiz/lesson/:lessonId" element={
              isLoggedIn ? <QuizPage /> : <Navigate to="/login" />
            } />

            {/* 6. Личный кабинет */}
            <Route path="/profile" element={
              isLoggedIn ? <Profile /> : <Navigate to="/login" />
            } />

            {/* 7. ПАНЕЛЬ УЧИТЕЛЯ (AI) - НОВЫЙ МАРШРУТ */}
            <Route path="/teacher" element={
              isLoggedIn ? <TeacherPanel /> : <Navigate to="/login" />
            } />

            {/* Редиректы */}
            <Route path="/" element={<Navigate to={isLoggedIn ? "/courses" : "/login"} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;