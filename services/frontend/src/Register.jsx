import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "./api"; 
import { toast } from 'react-toastify';

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
  
  // НОВОЕ: Состояния для видимости паролей
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "iin") {
      const onlyNumbers = value.replace(/\D/g, ''); 
      if (onlyNumbers.length <= 12) {
        setFormData({ ...formData, [name]: onlyNumbers });
      }
      return; 
    }
    setFormData({ ...formData, [name]: value });
  };

  // НОВОЕ: Функция для оценки силы пароля
  const getPasswordStrength = (pass) => {
    if (!pass) return { width: 'w-0', color: 'bg-gray-200', text: '' };
    if (pass.length < 6) return { width: 'w-1/3', color: 'bg-error', text: 'Слабый' };
    if (pass.length < 10 || !/\d/.test(pass)) return { width: 'w-2/3', color: 'bg-warning', text: 'Средний' };
    return { width: 'w-full', color: 'bg-success', text: 'Надежный' };
  };

  const strength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.iin && formData.iin.length !== 12) {
      setError("ИИН должен состоять ровно из 12 цифр!");
      return;
    }
    if (formData.password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Пароли не совпадают!");
      toast.warn("⚠️ Пароли не совпадают");
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
      
      toast.success("Отлично! Остался один шаг: проверьте почту.");
      // Перенаправляем на страницу ввода кода и "пробрасываем" email, чтобы юзеру не пришлось вводить его дважды
      navigate("/verify-email", { state: { email: formData.email } }); 
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

            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">ИИН (необязательно)</span>
              </label>
              <input 
                type="text" 
                name="iin" 
                value={formData.iin} 
                placeholder="12 цифр"
                className="input input-bordered w-full focus:input-primary bg-gray-50" 
                onChange={handleChange} 
              />
            </div>

            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">Пароль <span className="text-error">*</span></span>
              </label>
              {/* НОВОЕ: Глазик и индикатор пароля */}
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  name="password" 
                  placeholder="••••••••"
                  className="input input-bordered w-full focus:input-primary bg-gray-50 pr-10" 
                  onChange={handleChange} 
                  required 
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-primary transition-colors"
                >
                    {showPassword ? (
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                </button>
              </div>
              
              {/* НОВОЕ: Индикатор силы пароля */}
              {formData.password && (
                 <div className="mt-2">
                     <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                         <div className={`h-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
                     </div>
                     <p className="text-xs text-right mt-1 text-gray-500">{strength.text}</p>
                 </div>
              )}
            </div>

            <div className="form-control w-full">
              <label className="label pt-0">
                <span className="label-text font-semibold text-gray-600">Повторите пароль <span className="text-error">*</span></span>
              </label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword" 
                  placeholder="••••••••"
                  className="input input-bordered w-full focus:input-primary bg-gray-50 pr-10" 
                  onChange={handleChange} 
                  required 
                />
                <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-primary transition-colors"
                >
                    {showConfirmPassword ? (
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                </button>
              </div>
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