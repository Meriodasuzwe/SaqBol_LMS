import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from './api';

// Импорты для уведомлений (Toasts)
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// 👇 НОВОЕ: Импортируем провайдер Google
import { GoogleOAuthProvider } from '@react-oauth/google';

// Импорты страниц
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import VerifyEmail from './VerifyEmail';
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

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUserRole(null);
  };

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

  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  return (
    // 👇 Оборачиваем всё приложение в GoogleOAuthProvider и передаем твой Client ID
    <GoogleOAuthProvider clientId="938595288066-rme6f4ga3143r5f0f9j7pl4qsihhs54r.apps.googleusercontent.com">
        <Router>
          <div className="min-h-screen bg-base-100 font-sans text-base-content flex flex-col transition-colors duration-300">
            
            <ToastContainer 
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored" 
            />

            <Navbar 
                isLoggedIn={isLoggedIn} 
                userRole={userRole} 
                onLogout={handleLogout} 
            />

            <main className="container mx-auto p-4 lg:p-8 flex-grow">
              <Routes>
                <Route path="/login" element={
                  !isLoggedIn ? <Login onLoginSuccess={() => setIsLoggedIn(true)} /> : <Navigate to="/courses" />
                } />
                
                <Route path="/register" element={
                  !isLoggedIn ? <Register /> : <Navigate to="/courses" />
                } />
                <Route path="/verify-email" element={
                !isLoggedIn ? <VerifyEmail /> : <Navigate to="/courses" />
                } />

                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:uidb64/:token" element={<ResetPassword />} /> 

                <Route path="/courses" element={<CourseList />} />
                <Route path="/courses/:id" element={<CourseDetail isLoggedIn={isLoggedIn} />} />
                
                <Route path="/lesson/:lessonId" element={
                  isLoggedIn ? <LessonPage /> : <Navigate to="/login" />
                } />

                <Route path="/quiz/lesson/:lessonId" element={
                  isLoggedIn ? <QuizPage /> : <Navigate to="/login" />
                } />

                <Route path="/profile" element={
                  isLoggedIn ? <Profile /> : <Navigate to="/login" />
                } />

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

                <Route path="/" element={<Navigate to="/courses" />} />
                <Route path="*" element={<Navigate to="/courses" />} />

              </Routes>
            </main>

            <footer className="footer footer-center p-4 bg-base-200 text-base-content mt-auto">
              <div>
                <p>© 2026 SaqBol LMS - AI Education Platform</p>
              </div>
            </footer>

          </div>
        </Router>
    </GoogleOAuthProvider>
  );
}

export default App;