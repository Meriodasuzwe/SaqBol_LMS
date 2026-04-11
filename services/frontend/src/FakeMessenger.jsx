import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, Lock, ShieldAlert, XCircle, X } from 'lucide-react';
import './FakeMessenger.css';

const FakeMessenger = ({ scenario, onComplete, onExit }) => {
  const [history, setHistory] = useState([]);
  
  const [currentNodeId, setCurrentNodeId] = useState(0); 
  const [isTyping, setIsTyping] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  const [hackedMode, setHackedMode] = useState(false);
  const [fatalMessage, setFatalMessage] = useState(""); 

  const chatContainerRef = useRef(null);

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
  
  useEffect(() => {
    if (steps.length > 0 && history.length === 0) {
        setCurrentNodeId(steps[0].id !== undefined ? steps[0].id : 0);
    }
  }, [steps]);

  const currentStep = steps.find(s => s.id === currentNodeId) || steps[currentNodeId];

  const optionsArray = currentStep?.options || currentStep?.choices || [];
  const isChoiceStep = currentStep?.type === 'choice' || optionsArray.length > 0;

  const isMessageStep =
    !!currentStep &&
    !isChoiceStep &&
    (currentStep.type === 'message' || !!currentStep.text || !!currentStep.message || !!currentStep.content || !!currentStep.speaker);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isTyping]);

  useEffect(() => {
    if (!currentStep) return;

    if (isMessageStep) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        const textValue =
          currentStep.text || currentStep.message || currentStep.content || 
          currentStep.moshenik || currentStep.bot || 
          Object.values(currentStep).find(v => typeof v === 'string') || "...";

        const sp = (currentStep.speaker || "").toLowerCase();
        const sender = sp.includes("польз") || sp.includes("user") || sp.includes("victim") ? "user" : "bot";

        setHistory(prev => [...prev, { sender, text: textValue }]);
        setIsTyping(false);
        
        if (currentStep.next_step_id !== undefined) {
            setCurrentNodeId(currentStep.next_step_id);
        } else {
            setCurrentNodeId(prev => prev + 1);
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [currentNodeId, steps, currentStep, isMessageStep]);

  const handleOptionClick = (option) => {
    const btnText = option.text || option.answer || option.user || Object.values(option).find(v => typeof v === 'string') || "Выбрать";
    setHistory(prev => [...prev, { sender: 'user', text: btnText }]);

    const isFatal = option.is_fatal === true || option.is_correct === false || option.correct === false;
    const isExplicitSuccess = option.is_success === true;

    if (isFatal) {
      const errorReason = option.feedback || option.explanation || "Вы приняли неверное решение.";
      setFatalMessage(errorReason);
      setHackedMode(true);
      
      setTimeout(() => {
        setHackedMode(false);
        setFeedback({
          type: 'fail',
          text: errorReason
        });
      }, 4000); 
      return;
    }

    if (isExplicitSuccess) {
      setTimeout(() => setFeedback({
        type: 'success',
        text: option.feedback || option.explanation || "Отличный выбор! Вы справились с ситуацией."
      }), 500);
      return;
    }

    let delayForNextStep = 500;
    if (option.feedback && (option.is_correct === true || option.correct === true)) {
        setIsTyping(true);
        delayForNextStep = 1800; 
        setTimeout(() => {
            setHistory(prev => [...prev, { sender: 'bot', text: option.feedback }]);
            setIsTyping(false);
        }, 800);
    }

    let nextId = option.next_step_id;
    if (nextId === undefined) {
        const currentIndex = steps.findIndex(s => s.id === currentNodeId || s === currentStep);
        nextId = steps[currentIndex + 1]?.id !== undefined ? steps[currentIndex + 1].id : currentIndex + 1;
    }

    const hasNextStep = steps.find(s => s.id === nextId) || steps[nextId];

    if (!hasNextStep) {
        setTimeout(() => setFeedback({
          type: 'success',
          text: option.feedback || option.explanation || "Сценарий успешно пройден!"
        }), delayForNextStep + 500);
        return;
    }

    setTimeout(() => {
        setCurrentNodeId(nextId);
    }, delayForNextStep);
  };

  const handleFeedbackContinue = () => {
    if (!feedback) return;

    if (feedback.type === 'success') {
      setFeedback(null);
      onComplete?.(100); 
    } else {
      setHistory([]);
      setIsTyping(false);
      setFeedback(null);
      setHackedMode(false);
      setCurrentNodeId(steps.length > 0 ? (steps[0].id !== undefined ? steps[0].id : 0) : 0);
    }
  };

  // 🔥 ПОФИКСИЛИ ВЫХОД: Больше никакого ложного onComplete(0)
  const handleExit = () => {
    if (onExit) {
      onExit();
    }
  };

  if (!scenario) return <div className="p-10 text-center text-gray-400 font-bold animate-pulse">Загрузка перехвата связи...</div>;

  return (
    <div className="relative w-full max-w-md mx-auto overflow-hidden rounded-[2.5rem] shadow-2xl border-[6px] border-base-300 bg-base-100">
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {hackedMode && (
        <div className="absolute inset-0 z-50 bg-red-900 flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute inset-0 bg-black opacity-30 mix-blend-overlay"></div>
          
          <XCircle className="text-red-400 w-24 h-24 mb-6 relative z-10 animate-pulse" strokeWidth={2} />
          
          <h1 className="text-white text-3xl font-black mb-4 uppercase tracking-wider relative z-10 drop-shadow-md">
            Сценарий провален
          </h1>
          
          <div className="bg-red-950/50 border border-red-500/30 rounded-2xl p-5 relative z-10 backdrop-blur-sm w-full">
            <p className="text-red-100 font-medium text-lg leading-relaxed">
              {fatalMessage}
            </p>
          </div>

          <div className="w-full max-w-xs bg-red-950 rounded-full h-1.5 mt-8 relative z-10 overflow-hidden">
            <div className="bg-red-400 h-1.5 rounded-full animate-[width_4s_linear_forwards]" style={{ width: '0%' }}>
               <style>{`@keyframes width { to { width: 100%; } }`}</style>
            </div>
          </div>
        </div>
      )}

      <div className={`messenger-container border-0 rounded-none shadow-none m-0 transition-opacity duration-300 ${hackedMode ? 'opacity-0' : 'opacity-100'} flex flex-col h-[600px]`}>
        
        {/* Шапка мессенджера */}
        <div className="messenger-header bg-base-100/90 backdrop-blur-md border-b border-base-200 p-4 flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {parsedScenario.contact_name ? parsedScenario.contact_name[0] : "С"}
          </div>
          <div className="contact-info flex-1">
            <h3 className="font-bold text-base-content text-base leading-tight">{parsedScenario.contact_name || "Собеседник"}</h3>
            <span className="text-xs text-teal-600 dark:text-teal-400 font-medium tracking-wide">
                {isTyping ? "печатает..." : "в сети"}
            </span>
          </div>
          
          {/* Кнопка-крестик для выхода в любой момент */}
          <button 
            onClick={handleExit}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-base-200 text-base-content/40 hover:text-base-content/80 transition-colors shrink-0"
            title="Завершить симуляцию"
          >
            <X size={20} />
          </button>
        </div>

        {/* Тело чата */}
        <div 
            ref={chatContainerRef}
            className="messenger-body hide-scrollbar bg-slate-50 dark:bg-base-300 flex-1 p-5 space-y-4 overflow-y-auto"
        >
          {history.map((msg, idx) => (
            <div key={idx} className={`flex w-full ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`message shadow-sm px-4 py-2.5 max-w-[80%] text-sm md:text-base leading-relaxed ${
                    msg.sender === 'bot' 
                    ? 'bg-white dark:bg-base-100 text-base-content rounded-2xl rounded-tl-sm border border-slate-100 dark:border-base-200' 
                    : 'bg-teal-600 text-white rounded-2xl rounded-tr-sm'
                }`}>
                  {msg.text}
                </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex w-full justify-start">
                <div className="bg-white dark:bg-base-100 border border-slate-100 dark:border-base-200 text-base-content/50 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce delay-100"></div>
                  <div className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce delay-200"></div>
                </div>
            </div>
          )}
        </div>

        {/* Подвал с кнопками */}
        <div className="messenger-footer bg-white dark:bg-base-100 p-4 border-t border-slate-100 dark:border-base-200 flex flex-col gap-2 min-h-[120px] justify-center shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          {isChoiceStep && !feedback && !hackedMode && (
            <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-bottom-4">
              {optionsArray.map((opt, idx) => (
                <button
                  key={idx}
                  className="w-full text-left bg-slate-50 dark:bg-base-200 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-base-content font-medium text-sm p-3.5 rounded-xl transition-all border border-slate-200 dark:border-base-300 hover:border-teal-400 dark:hover:border-teal-500 active:scale-[0.98]"
                  onClick={() => handleOptionClick(opt)}
                >
                  {opt.text || opt.answer || Object.values(opt).find(v => typeof v === 'string') || `Вариант ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Попап обратной связи */}
        {feedback && !hackedMode && (
          <div className="absolute inset-0 z-40 bg-white/95 dark:bg-base-100/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200 rounded-[2rem]">
            <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl rotate-3 ${feedback.type === 'success' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' : 'bg-gradient-to-br from-red-400 to-red-600 text-white'}`}>
                {feedback.type === 'success' ? <Lock size={48} /> : <AlertTriangle size={48} />}
            </div>
            <h2 className={`text-3xl font-black mb-4 ${feedback.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {feedback.type === 'success' ? "Сценарий пройден" : "Вы допустили ошибку"}
            </h2>
            <p className="text-base-content/80 mb-8 leading-relaxed font-medium">
                {feedback.text}
            </p>
            <button 
                className={`w-full font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 ${feedback.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-slate-200 dark:bg-base-300 hover:bg-slate-300 dark:hover:bg-base-200 text-base-content'}`}
                onClick={handleFeedbackContinue}
            >
              {feedback.type === 'success' ? "Продолжить обучение" : "Попробовать снова"}
            </button>
            
            {/* Текстовая кнопка выхода для экрана провала */}
            {feedback.type !== 'success' && (
              <button 
                onClick={handleExit}
                className="mt-6 text-sm font-semibold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              >
                Вернуться к уроку
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FakeMessenger;