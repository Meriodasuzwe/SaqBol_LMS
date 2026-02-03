import React, { useState, useEffect, useRef } from 'react';
import './FakeMessenger.css';

const FakeMessenger = ({ scenario, onComplete }) => {
    // scenario - это JSON, который пришел с бэкенда
    
    const [history, setHistory] = useState([]); // История сообщений на экране
    const [currentIndex, setCurrentIndex] = useState(0); // На каком шаге сценария мы сейчас
    const [isTyping, setIsTyping] = useState(false); // Эффект "печатает..."
    const [feedback, setFeedback] = useState(null); // Результат выбора (Правильно/Ошибка)
    
    // Ссылка для авто-скролла вниз
    const messagesEndRef = useRef(null);

    const steps = scenario?.steps || [];
    const currentStep = steps[currentIndex];

    // Авто-скролл к последнему сообщению
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history, isTyping]);

    // Логика запуска шага
    useEffect(() => {
        if (!currentStep) {
            // Если шаги кончились - победа!
            if (currentIndex >= steps.length && steps.length > 0) {
                onComplete(100); // 100 XP за успешное прохождение
            }
            return;
        }

        if (currentStep.type === 'message') {
            setIsTyping(true);
            // Имитация задержки (как будто человек пишет)
            const timer = setTimeout(() => {
                setHistory(prev => [...prev, { 
                    sender: 'bot', 
                    text: currentStep.text 
                }]);
                setIsTyping(false);
                setCurrentIndex(prev => prev + 1);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, steps, onComplete]);

    const handleOptionClick = (option) => {
        // Добавляем выбор пользователя в чат
        setHistory(prev => [...prev, { sender: 'user', text: option.text }]);

        if (option.is_correct) {
            // Если правильно
            setTimeout(() => {
                setFeedback({ type: 'success', text: option.feedback || "Правильно!" });
            }, 500);
        } else {
            // Если ошибка - атака удалась :(
            setTimeout(() => {
                setFeedback({ type: 'fail', text: option.feedback || "Вы попались на уловку!" });
            }, 500);
        }
    };

    const handleFeedbackContinue = () => {
        if (feedback.type === 'success') {
            setFeedback(null);
            setCurrentIndex(prev => prev + 1);
        } else {
            // Если проиграл - перезапуск или выход (пока сделаем перезапуск сценария)
            alert("Попробуйте еще раз!");
            setHistory([]);
            setCurrentIndex(0);
            setFeedback(null);
        }
    };

    if (!scenario) return <div>Загрузка сценария...</div>;

    return (
        <div className="messenger-container">
            {/* Header */}
            <div className="messenger-header">
                <div className="avatar">?</div>
                <div className="contact-info">
                    <h3>{scenario.contact_name || "Неизвестный"}</h3>
                    <span>{isTyping ? "печатает..." : "в сети"}</span>
                </div>
            </div>

            {/* Chat Body */}
            <div className="messenger-body">
                {history.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.sender}`}>
                        {msg.text}
                        <div className="message-time">12:30</div>
                    </div>
                ))}
                {isTyping && (
                    <div className="message bot" style={{opacity: 0.7}}>...</div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Footer / Controls */}
            <div className="messenger-footer">
                {currentStep?.type === 'choice' && !feedback && (
                    <div className="options-grid">
                        {currentStep.options.map((opt, idx) => (
                            <button 
                                key={idx} 
                                className="option-btn"
                                onClick={() => handleOptionClick(opt)}
                            >
                                {opt.text}
                            </button>
                        ))}
                    </div>
                )}
                {currentStep?.type !== 'choice' && !isTyping && !feedback && (
                   <div style={{color: '#999', textAlign: 'center', fontSize: '12px'}}>
                       Собеседник пишет...
                   </div>
                )}
            </div>

            {/* Feedback Overlay (Win/Loss) */}
            {feedback && (
                <div className="feedback-overlay">
                    {feedback.type === 'success' ? (
                        <div className="feedback-success">✅ Отлично!</div>
                    ) : (
                        <div className="feedback-fail">❌ Ошибка</div>
                    )}
                    <p>{feedback.text}</p>
                    <button className="continue-btn" onClick={handleFeedbackContinue}>
                        {feedback.type === 'success' ? "Продолжить" : "Попробовать снова"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FakeMessenger;