import React, { useState } from 'react';
import './FakeEmail.css';

const FakeEmail = ({ scenario, onComplete }) => {
    // scenario ожидает:
    // {
    //   "subject": "Срочно: Обновление пароля",
    //   "sender_name": "IT Support",
    //   "sender_email": "support@company-security.com", (или fake)
    //   "body_html": "Текст письма с <a href...>",
    //   "is_phishing": true,
    //   "explanation": "Обратите внимание на домен отправителя..."
    // }

    const [answered, setAnswered] = useState(false);
    const [result, setResult] = useState(null); // 'win' | 'lose'

    const handleDecision = (choice) => {
        // choice: 'phishing' или 'safe'
        const isActuallyPhishing = scenario.is_phishing;
        
        let success = false;
        if (choice === 'phishing' && isActuallyPhishing) success = true;
        if (choice === 'safe' && !isActuallyPhishing) success = true;

        setResult(success ? 'win' : 'lose');
        setAnswered(true);

        if (success) {
            // Задержка перед переходом, чтобы прочитать объяснение
            setTimeout(() => onComplete(50), 3000); // 50 XP
        }
    };

    // Функция для безопасного рендеринга HTML из JSON (простая версия)
    // В реальном проекте лучше использовать DOMPurify, но для диплома сойдет
    const createMarkup = () => {
        return { __html: scenario.body_html };
    };

    return (
        <div className="email-client-container">
            {/* Панель инструментов */}
            <div className="email-toolbar">
                <button 
                    className="toolbar-btn phishing-btn" 
                    onClick={() => handleDecision('phishing')}
                    disabled={answered}
                >
                    🚨 Это Фишинг!
                </button>
                <button 
                    className="toolbar-btn safe-btn" 
                    onClick={() => handleDecision('safe')}
                    disabled={answered}
                >
                    ✅ Безопасно
                </button>
                <div style={{flex: 1}}></div>
                <button className="toolbar-btn">Ответить</button>
                <button className="toolbar-btn">Удалить</button>
            </div>

            {/* Контент письма */}
            <div className="email-content">
                <div className="email-header">
                    <div className="email-subject">{scenario.subject}</div>
                    <div className="sender-info">
                        <div className="sender-avatar">
                            {scenario.sender_name ? scenario.sender_name[0] : 'A'}
                        </div>
                        <div className="sender-details">
                            <span className="sender-name">{scenario.sender_name}</span>
                            <span className="sender-email">&lt;{scenario.sender_email}&gt;</span>
                        </div>
                    </div>
                </div>

                {/* Тело письма */}
                <div 
                    className="email-body"
                    dangerouslySetInnerHTML={createMarkup()} 
                />
            </div>

            {/* Блок результата */}
            {answered && (
                <div className="result-overlay">
                    {result === 'win' ? (
                        <h3 style={{color: 'green'}}>Верно! 🎉</h3>
                    ) : (
                        <h3 style={{color: 'red'}}>Ошибка ❌</h3>
                    )}
                    <p>{scenario.explanation}</p>
                    
                    {result === 'lose' && (
                        <button 
                            className="toolbar-btn" 
                            onClick={() => { setAnswered(false); setResult(null); }}
                        >
                            Попробовать снова
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default FakeEmail;