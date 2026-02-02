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
      // Отправляем запрос на создание пользователя
      // Обрати внимание: путь должен совпадать с urls.py (users/register/)
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
         // Превращаем объект ошибок от Django в строку
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
    <div className="flex items-center justify-center mt-12 mb-12">
      <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-200">
        <div className="card-body">
          <h2 className="card-title justify-center text-2xl font-bold text-center mb-4">
            Регистрация
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Логин *</span></label>
              <input type="text" name="username" className="input input-bordered focus:input-primary" onChange={handleChange} required />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Email *</span></label>
              <input type="email" name="email" className="input input-bordered focus:input-primary" onChange={handleChange} required />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">ИИН (необязательно)</span></label>
              <input type="text" name="iin" className="input input-bordered focus:input-primary" onChange={handleChange} />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Пароль *</span></label>
              <input type="password" name="password" className="input input-bordered focus:input-primary" onChange={handleChange} required />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Повторите пароль *</span></label>
              <input type="password" name="confirmPassword" className="input input-bordered focus:input-primary" onChange={handleChange} required />
            </div>

            {error && <div className="alert alert-error text-sm mt-2">{error}</div>}

            <div className="card-actions mt-6">
                <button 
                    type="submit" 
                    className={`btn btn-primary btn-block ${loading ? 'loading' : ''}`}
                    disabled={loading}
                >
                    {loading ? 'Создаем аккаунт...' : 'Создать аккаунт'}
                </button>
            </div>
          </form>

          <div className="divider">ИЛИ</div>

          <div className="text-center">
            <span className="text-gray-500 text-sm">Уже есть аккаунт? </span>
            <Link to="/login" className="link link-primary font-bold">
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;