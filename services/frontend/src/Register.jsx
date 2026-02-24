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
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    // НОВОЕ: Умная обработка для ИИН (только цифры и максимум 12 символов)
    if (name === "iin") {
      const onlyNumbers = value.replace(/\D/g, ''); // Удаляем все, кроме цифр
      if (onlyNumbers.length <= 12) {
        setFormData({ ...formData, [name]: onlyNumbers });
      }
      return; // Выходим, чтобы не сработал стандартный setFormData
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // НОВОЕ: Проверка длины ИИН (если он введен, он должен быть ровно 12 цифр)
    if (formData.iin && formData.iin.length !== 12) {
      setError("ИИН должен состоять ровно из 12 цифр!");
      return;
    }

    // НОВОЕ: Базовая проверка длины пароля (чтобы не мешало тестить, но отсекало мусор)
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
      
      toast.success("Регистрация успешна! Теперь войдите в аккаунт.");
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
                value={formData.iin} // НОВОЕ: Привязали value к state, чтобы маска работала визуально
                placeholder="12 цифр"
                className="input input-bordered w-full focus:input-primary bg-gray-50" 
                onChange={handleChange} 
              />
            </div>

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