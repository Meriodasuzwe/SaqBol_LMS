import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'; // 🔥 ДОБАВИЛИ Link
import { useState, useEffect } from 'react';
import api from './api';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { GoogleOAuthProvider } from '@react-oauth/google';

import Login from './Login';
import Register from './Register';
import Landing from './Landing';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import VerifyEmail from './VerifyEmail';
import CourseList from './CourseList';
import CourseDetail from './CourseDetail';
import QuizPage from './QuizPage';
import Profile from './Profile';
import LessonPage from './LessonPage';
import TeacherPanel from './TeacherPanel';
import CourseBuilder from './CourseBuilder/CourseBuilder';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Cookies from './pages/legal/Cookies';
import DataProcessing from './pages/legal/DataProcessing';
import Navbar from './Navbar';

function AppLayout({ isLoggedIn, userRole, onLogout, isTeacher, onLoginSuccess }) {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen bg-base-100 font-sans text-base-content flex flex-col transition-colors duration-300">
      <Navbar
        isLoggedIn={isLoggedIn}
        userRole={userRole}
        onLogout={onLogout}
      />

      {isLanding ? (
        // Landing — без контейнера, на всю ширину
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing />} />
          </Routes>
        </main>
      ) : (
        // Все остальные страницы — с обычным padding
        <main className="container mx-auto p-4 lg:p-8 flex-grow">
          <Routes>
            <Route path="/login" element={
              !isLoggedIn ? <Login onLoginSuccess={onLoginSuccess} /> : <Navigate to="/courses" />
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
            
            
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/data-processing" element={<DataProcessing />} />
            
            <Route path="*" element={<Navigate to="/courses" />} />
          </Routes>
        </main>
      )}

      <footer className="bg-slate-900 text-slate-400 mt-auto" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-xs">SQ</span>
                </div>
                <span className="font-extrabold text-white text-base tracking-tight">SaqBol <span className="font-normal text-slate-400">LMS</span></span>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                Интеллектуальная платформа для корпоративного обучения и повышения цифровой грамотности персонала.
              </p>
            </div>

            {/* Platform */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Платформа</p>
              <ul className="space-y-3 text-sm">
                <li><Link to="/courses" className="hover:text-white transition-colors">Каталог курсов</Link></li>
                <li><Link to="/#tracks" className="hover:text-white transition-colors">Направления</Link></li>
                <li><Link to="/#features" className="hover:text-white transition-colors">Возможности</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Начать бесплатно</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Компания</p>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">О нас</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Блог</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Карьера</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Контакты</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Правовое</p>
              <ul className="space-y-3 text-sm">
                
                <li><Link to="/privacy" className="hover:text-white transition-colors">Политика конфиденциальности</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Пользовательское соглашение</Link></li>
                <li><Link to="/data-processing" className="hover:text-white transition-colors">Обработка данных</Link></li>
                <li><Link to="/cookies" className="hover:text-white transition-colors"> Cookie</Link></li>
              </ul>
            </div>

          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-600">© 2026 SaqBol LMS — AI Education Platform. Все права защищены.</p>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>🇰🇿 Казахстан</span>
              <span>·</span>
              <a href="mailto:hello@saqbol.kz" className="hover:text-slate-400 transition-colors">dev.saqbol@gmail.com</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access'));
  const [userRole, setUserRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUserRole(null);
  };

  useEffect(() => {
    if (isLoggedIn) {
      setLoadingRole(true);
      api.get('users/me/')
        .then(response => setUserRole(response.data.role))
        .catch(err => {
          console.error("Не удалось получить роль", err);
          if (err.response?.status === 401) handleLogout();
        })
        .finally(() => setLoadingRole(false));
    } else {
      setUserRole(null);
    }
  }, [isLoggedIn]);

  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  return (
    <GoogleOAuthProvider clientId="938595288066-rme6f4ga3143r5f0f9j7pl4qsihhs54r.apps.googleusercontent.com">
      <Router>
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
        <AppLayout
          isLoggedIn={isLoggedIn}
          userRole={userRole}
          onLogout={handleLogout}
          isTeacher={isTeacher}
          onLoginSuccess={() => setIsLoggedIn(true)}
        />
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;