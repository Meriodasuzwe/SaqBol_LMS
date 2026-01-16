import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useState } from 'react';
import Login from './Login';
import CourseList from './CourseList';
import CourseDetail from './CourseDetail';
import QuizPage from './QuizPage';
import Profile from './Profile'; // Новый компонент профиля

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access'));

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial' }}>
        <header style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid #eee', 
          marginBottom: '20px',
          paddingBottom: '10px'
        }}>
          <h1 style={{ margin: 0 }}>SaqBol Platform</h1>
          
          {isLoggedIn && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Link to="/courses" style={{ textDecoration: 'none', color: '#3498db', fontWeight: 'bold' }}>Курсы</Link>
              <Link to="/profile" style={{ textDecoration: 'none', color: '#3498db', fontWeight: 'bold' }}>Профиль</Link>
              <button 
                onClick={handleLogout} 
                style={{ 
                  padding: '5px 15px', 
                  cursor: 'pointer', 
                  backgroundColor: '#e74c3c', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px' 
                }}
              >
                Выйти
              </button>
            </nav>
          )}
        </header>

        <Routes>
          {/* 1. Логин */}
          <Route path="/login" element={
            !isLoggedIn ? <Login onLoginSuccess={() => setIsLoggedIn(true)} /> : <Navigate to="/courses" />
          } />

          {/* 2. Все курсы */}
          <Route path="/courses" element={
            isLoggedIn ? <CourseList /> : <Navigate to="/login" />
          } />
          
          {/* 3. Детали курса */}
          <Route path="/courses/:id" element={
            isLoggedIn ? <CourseDetail /> : <Navigate to="/login" />
          } />

          {/* 4. Страница теста */}
          <Route path="/quiz/lesson/:lessonId" element={
            isLoggedIn ? <QuizPage /> : <Navigate to="/login" />
          } />

          {/* 5. Личный кабинет */}
          <Route path="/profile" element={
            isLoggedIn ? <Profile /> : <Navigate to="/login" />
          } />

          {/* 6. Редиректы */}
          <Route path="/" element={<Navigate to={isLoggedIn ? "/courses" : "/login"} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;