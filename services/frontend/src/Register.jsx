import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "./api"; 

const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    iin: "" 
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Пароли не совпадают!");
      return;
    }

    setLoading(true);

    try {
      await api.post("users/register/", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        iin: formData.iin
      });
      
      alert("Регистрация успешна! Теперь вы можете войти.");
      navigate("/login"); 
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data) {
         const errorMsg = Object.values(err.response.data).flat().join(", ");
         setError(errorMsg || "Ошибка регистрации");
      } else {
        setError("Ошибка соединения с сервером");
      }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
        <div className="card-body p-8">
          <h2 className="text-3xl font-bold text-center text-primary mb-6">
            Регистрация
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* ГРУППА: ЛОГИН */}
            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">Логин <span className="text-error">*</span></span>
              </label>
              <input 
                type="text" 
                name="username" 
                placeholder="Придумайте логин"
                className="input input-bordered w-full focus:input-primary bg-gray-50" 
                onChange={handleChange} 
                required 
              />
            </div>

            {/* ГРУППА: EMAIL */}
            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">Email <span className="text-error">*</span></span>
              </label>
              <input 
                type="email" 
                name="email" 
                placeholder="example@mail.com"
                className="input input-bordered w-full focus:input-primary bg-gray-50" 
                onChange={handleChange} 
                required 
              />
            </div>

            {/* ГРУППА: ИИН */}
            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">ИИН (необязательно)</span>
              </label>
              <input 
                type="text" 
                name="iin" 
                placeholder="12 цифр"
                className="input input-bordered w-full focus:input-primary bg-gray-50" 
                onChange={handleChange} 
              />
            </div>

            {/* ГРУППА: ПАРОЛЬ */}
            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">Пароль <span className="text-error">*</span></span>
              </label>
              <input 
                type="password" 
                name="password" 
                placeholder="••••••••"
                className="input input-bordered w-full focus:input-primary bg-gray-50" 
                onChange={handleChange} 
                required 
              />
            </div>

            {/* ГРУППА: ПОВТОР ПАРОЛЯ */}
            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">Повторите пароль <span className="text-error">*</span></span>
              </label>
              <input 
                type="password" 
                name="confirmPassword" 
                placeholder="••••••••"
                className="input input-bordered w-full focus:input-primary bg-gray-50" 
                onChange={handleChange} 
                required 
              />
            </div>

            {error && <div className="alert alert-error text-sm shadow-sm">{error}</div>}

            <button 
                type="submit" 
                className={`btn btn-primary w-full text-lg mt-4 ${loading ? 'loading' : ''}`}
                disabled={loading}
            >
                {loading ? 'Создаем...' : 'Создать аккаунт'}
            </button>
          </form>

          <div className="divider my-6">ИЛИ</div>

          <p className="text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="link link-primary font-bold hover:text-primary-focus transition-colors">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;