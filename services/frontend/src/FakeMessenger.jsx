import React, { useState, useEffect, useRef, useMemo } from 'react';
import './FakeMessenger.css';

const FakeMessenger = ({ scenario, onComplete }) => {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const messagesEndRef = useRef(null);

  const parsedScenario = useMemo(() => {
    if (!scenario) return {};
    let obj = scenario;

    if (typeof scenario === 'string') {
      try {
        const cleanStr = scenario.replace(/```json/gi, '').replace(/```/g, '').trim();
        obj = JSON.parse(cleanStr);
      } catch (e) {
        console.error("Ошибка парсинга:", e);
        return {};
      }
    }

    if (obj && obj.scenario_data) return obj.scenario_data;
    return obj;
  }, [scenario]);

  const steps = parsedScenario.steps || parsedScenario.messages || parsedScenario.dialogue || [];
  const currentStep = steps[currentIndex];

  const optionsArray = currentStep?.options || currentStep?.choices || [];
  const isChoiceStep = currentStep?.type === 'choice' || optionsArray.length > 0;

  // message step: либо явно type=message, либо speaker/text (legacy), либо просто текст без options
  const isMessageStep =
    !!currentStep &&
    !isChoiceStep &&
    (currentStep.type === 'message' || !!currentStep.text || !!currentStep.message || !!currentStep.content || !!currentStep.speaker);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isTyping]);

  useEffect(() => {
    if (!currentStep) {
      if (currentIndex >= steps.length && steps.length > 0) {
        onComplete?.(100);
      }
      return;
    }

    if (isMessageStep) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        const textValue =
          currentStep.text ||
          currentStep.message ||
          currentStep.content ||
          currentStep.moshenik ||
          currentStep.bot ||
          Object.values(currentStep).find(v => typeof v === 'string') ||
          "...";

        // ✅ ВАЖНО: если пришёл legacy speaker-формат — показываем корректного отправителя
        const sp = (currentStep.speaker || "").toLowerCase();
        const sender =
          sp.includes("польз") || sp.includes("user") || sp.includes("victim")
            ? "user"
            : "bot";

        setHistory(prev => [...prev, { sender, text: textValue }]);
        setIsTyping(false);
        setCurrentIndex(prev => prev + 1);
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, steps, currentStep, isMessageStep, onComplete]);

  const handleOptionClick = (option) => {
    const btnText =
      option.text ||
      option.answer ||
      option.user ||
      Object.values(option).find(v => typeof v === 'string') ||
      "Выбрать";

    setHistory(prev => [...prev, { sender: 'user', text: btnText }]);

    const isCorrect =
      option.is_correct === true ||
      String(option.is_correct).toLowerCase() === 'true' ||
      option.isCorrect === true ||
      option.correct === true;

    if (isCorrect) {
      setTimeout(() => setFeedback({
        type: 'success',
        text: option.feedback || option.explanation || "Отличный выбор! Вы распознали угрозу."
      }), 250);
    } else {
      setTimeout(() => setFeedback({
        type: 'fail',
        text: option.feedback || option.explanation || "К сожалению, это ошибка. Мошенник добился своего."
      }), 250);
    }
  };

  const handleFeedbackContinue = () => {
    if (!feedback) return;

    if (feedback.type === 'success') {
      setFeedback(null);
      setCurrentIndex(prev => prev + 1);
    } else {
      alert("Попробуйте еще раз!");
      setHistory([]);
      setCurrentIndex(0);
      setFeedback(null);
    }
  };

  if (!scenario) return <div className="p-10 text-center text-gray-400">Загрузка сценария...</div>;

  if (steps.length === 0) return (
    <div className="p-10 text-center text-error border-2 border-error/20 rounded-xl bg-error/5 max-w-md mx-auto">
      <h3 className="font-bold text-lg mb-2">Ошибка: Шаги не найдены</h3>
      <p className="text-sm">Нейросеть не смогла сгенерировать диалог.</p>
    </div>
  );

  return (
    <div className="messenger-container">
      <div className="messenger-header">
        <div className="avatar">?</div>
        <div className="contact-info">
          <h3>{parsedScenario.contact_name || parsedScenario.name || "Служба безопасности"}</h3>
          <span>{isTyping ? "печатает..." : "в сети"}</span>
        </div>
      </div>

      <div className="messenger-body">
        {history.map((msg, idx) => (
          <div key={idx} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div className="message bot" style={{ opacity: 0.7 }}>...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="messenger-footer">
        {isChoiceStep && !feedback && (
          <div className="options-grid">
            {optionsArray.map((opt, idx) => (
              <button
                key={idx}
                className="option-btn"
                onClick={() => handleOptionClick(opt)}
              >
                {opt.text || opt.answer || Object.values(opt).find(v => typeof v === 'string') || `Вариант ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {feedback && (
        <div className="feedback-overlay">
          <div className={feedback.type === 'success' ? "feedback-success" : "feedback-fail"}>
            {feedback.type === 'success' ? "✅ Отлично!" : "❌ Ошибка"}
          </div>
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