import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from './api';

// Импорты страниц
import Login from './Login';
import Register from './Register';
import CourseList from './CourseList';
import CourseDetail from './CourseDetail';
import QuizPage from './QuizPage';
import Profile from './Profile';
import LessonPage from './LessonPage';
import TeacherPanel from './TeacherPanel';
import CourseBuilder from './CourseBuilder';
import Navbar from './Navbar';

function App() {
  // 1. Состояние авторизации
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access'));
  
  // 2. Состояние роли
  const [userRole, setUserRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(false);

  // 3. Проверка роли при загрузке
  useEffect(() => {
    if (isLoggedIn) {
      setLoadingRole(true);
      api.get('users/me/')
        .then(response => {
          setUserRole(response.data.role); 
        })
        .catch(err => {
          console.error("Не удалось получить роль", err);
          if (err.response && err.response.status === 401) {
             handleLogout();
          }
        })
        .finally(() => setLoadingRole(false));
    } else {
      setUserRole(null);
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUserRole(null);
  };

  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  return (
    <Router>
      <div className="min-h-screen bg-base-100 font-sans text-base-content flex flex-col transition-colors duration-300">
        
        {/* 🔥 ЗАМЕНИЛИ СТАРЫЙ HEADER НА НОВЫЙ NAVBAR */}
        {/* Передаем туда состояние и функцию выхода, чтобы Navbar знал, что показывать */}
        <Navbar 
            isLoggedIn={isLoggedIn} 
            userRole={userRole} 
            onLogout={handleLogout} 
        />

        {/* --- ОСНОВНОЙ КОНТЕНТ --- */}
        <main className="container mx-auto p-4 lg:p-8 flex-grow">
          <Routes>
            {/* 1. АВТОРИЗАЦИЯ */}
            <Route path="/login" element={
              !isLoggedIn ? <Login onLoginSuccess={() => setIsLoggedIn(true)} /> : <Navigate to="/courses" />
            } />
            
            <Route path="/register" element={
              !isLoggedIn ? <Register /> : <Navigate to="/courses" />
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

            {/* 3. ИНТЕРФЕЙС УЧИТЕЛЯ */}
            <Route path="/teacher/course/:courseId/builder" element={
              isLoggedIn ? (
                 isTeacher ? <CourseBuilder /> : <Navigate to="/courses" />
              ) : <Navigate to="/login" />
            } />

            <Route path="/teacher" element={
              isLoggedIn ? (
                 isTeacher ? <TeacherPanel /> : <Navigate to="/courses" />
              ) : <Navigate to="/login" />
            } />

            {/* --- РЕДИРЕКТЫ --- */}
            <Route path="/" element={<Navigate to={isLoggedIn ? "/courses" : "/login"} />} />
            <Route path="*" element={<Navigate to="/" />} />

          </Routes>
        </main>

        {/* --- ПОДВАЛ --- */}
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