import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

// ─── SVG ILLUSTRATIONS ────────────────────────────────────────────────────────

const IllustrationSecurity = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="140" cy="100" r="85" fill="#EFF6FF" />
    <circle cx="140" cy="100" r="60" fill="#DBEAFE" />
    <path d="M140 40 L175 58 L175 98 C175 118 160 134 140 142 C120 134 105 118 105 98 L105 58 Z" fill="#2563EB" />
    <path d="M140 52 L165 66 L165 98 C165 114 154 127 140 134 C126 127 115 114 115 98 L115 66 Z" fill="#1D4ED8" />
    <path d="M127 98 L136 107 L155 86" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="85" cy="65" r="5" fill="#93C5FD" opacity="0.8" />
    <circle cx="195" cy="75" r="7" fill="#60A5FA" opacity="0.6" />
    <circle cx="78" cy="130" r="4" fill="#BFDBFE" opacity="0.9" />
    <circle cx="200" cy="130" r="5" fill="#93C5FD" opacity="0.7" />
    <circle cx="110" cy="155" r="3" fill="#DBEAFE" />
    <circle cx="170" cy="152" r="4" fill="#BFDBFE" />
    <rect x="54" y="85" width="22" height="17" rx="3" fill="#3B82F6" opacity="0.3" />
    <path d="M60 85 L60 80 C60 76 66 76 66 80 L66 85" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M204 82 L210 93 L198 93 Z" fill="#F59E0B" opacity="0.4" />
    <text x="205" y="91" fontSize="6" fill="#D97706" fontWeight="bold" opacity="0.7">!</text>
  </svg>
);

const IllustrationLearning = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="140" cy="100" r="85" fill="#F0FDF4" />
    <circle cx="140" cy="100" r="60" fill="#DCFCE7" />
    <rect x="95" y="62" width="90" height="62" rx="6" fill="#1E293B" />
    <rect x="99" y="66" width="82" height="50" rx="4" fill="#0F172A" />
    <rect x="105" y="72" width="35" height="3" rx="1.5" fill="#34D399" />
    <rect x="105" y="79" width="25" height="3" rx="1.5" fill="#6EE7B7" opacity="0.7" />
    <rect x="109" y="86" width="40" height="3" rx="1.5" fill="#34D399" opacity="0.5" />
    <rect x="109" y="93" width="30" height="3" rx="1.5" fill="#6EE7B7" opacity="0.6" />
    <rect x="105" y="100" width="45" height="3" rx="1.5" fill="#34D399" opacity="0.4" />
    <rect x="152" y="100" width="2" height="10" rx="1" fill="#34D399" />
    <rect x="133" y="124" width="14" height="8" rx="2" fill="#334155" />
    <rect x="125" y="132" width="30" height="4" rx="2" fill="#475569" />
    <circle cx="175" cy="75" r="14" fill="#059669" />
    <path d="M172 70 L181 75 L172 80 Z" fill="white" />
    <circle cx="82" cy="72" r="6" fill="#86EFAC" opacity="0.7" />
    <circle cx="198" cy="115" r="5" fill="#6EE7B7" opacity="0.6" />
    <circle cx="88" cy="130" r="4" fill="#BBF7D0" opacity="0.8" />
    <path d="M75 100 L77 106 L83 106 L78 110 L80 116 L75 112 L70 116 L72 110 L67 106 L73 106 Z" fill="#FCD34D" opacity="0.6" />
  </svg>
);

const IllustrationAI = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="140" cy="100" r="85" fill="#FFF7ED" />
    <circle cx="140" cy="100" r="60" fill="#FFEDD5" />
    <rect x="112" y="65" width="56" height="50" rx="10" fill="#F97316" />
    <rect x="116" y="69" width="48" height="38" rx="8" fill="#EA580C" />
    <circle cx="130" cy="84" r="7" fill="white" />
    <circle cx="150" cy="84" r="7" fill="white" />
    <circle cx="131" cy="85" r="4" fill="#1E293B" />
    <circle cx="151" cy="85" r="4" fill="#1E293B" />
    <circle cx="132" cy="84" r="1.5" fill="white" />
    <circle cx="152" cy="84" r="1.5" fill="white" />
    <path d="M128 97 Q140 105 152 97" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <rect x="138" y="55" width="4" height="12" rx="2" fill="#FB923C" />
    <circle cx="140" cy="53" r="5" fill="#FCD34D" />
    <rect x="104" y="78" width="10" height="18" rx="4" fill="#F97316" />
    <rect x="166" y="78" width="10" height="18" rx="4" fill="#F97316" />
    <rect x="124" y="115" width="32" height="14" rx="6" fill="#F97316" opacity="0.5" />
    <rect x="60" y="62" width="38" height="22" rx="8" fill="#FED7AA" />
    <path d="M88 84 L92 90 L82 84 Z" fill="#FED7AA" />
    <rect x="64" y="68" width="28" height="4" rx="2" fill="#F97316" opacity="0.5" />
    <rect x="64" y="75" width="20" height="4" rx="2" fill="#F97316" opacity="0.3" />
    <circle cx="195" cy="68" r="6" fill="#FDBA74" opacity="0.7" />
    <circle cx="200" cy="130" r="5" fill="#FED7AA" opacity="0.8" />
    <circle cx="80" cy="130" r="4" fill="#FFEDD5" opacity="0.9" />
    <path d="M192 90 L193 95 L198 96 L193 97 L192 102 L191 97 L186 96 L191 95 Z" fill="#FCD34D" opacity="0.8" />
  </svg>
);

const IllustrationAchieve = () => (
  <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
    <circle cx="140" cy="100" r="85" fill="#FFF1F2" />
    <circle cx="140" cy="100" r="60" fill="#FFE4E6" />
    <rect x="125" y="115" width="30" height="8" rx="3" fill="#F43F5E" />
    <rect x="119" y="123" width="42" height="5" rx="2.5" fill="#E11D48" />
    <path d="M122 70 L122 108 Q122 115 140 115 Q158 115 158 108 L158 70 Z" fill="#F43F5E" />
    <path d="M126 74 L126 106 Q126 112 140 112 Q154 112 154 106 L154 74 Z" fill="#FB7185" />
    <path d="M122 80 Q108 80 108 92 Q108 104 122 104" stroke="#F43F5E" strokeWidth="6" strokeLinecap="round" fill="none" />
    <path d="M158 80 Q172 80 172 92 Q172 104 158 104" stroke="#F43F5E" strokeWidth="6" strokeLinecap="round" fill="none" />
    <path d="M140 82 L143 91 L153 91 L145 97 L148 106 L140 100 L132 106 L135 97 L127 91 L137 91 Z" fill="white" opacity="0.9" />
    <path d="M90 60 L92 67 L99 67 L93 71 L95 78 L90 74 L85 78 L87 71 L81 67 L88 67 Z" fill="#FCD34D" opacity="0.8" />
    <path d="M190 55 L191.5 60 L197 60 L192.5 63 L194 68 L190 65 L186 68 L187.5 63 L183 60 L188.5 60 Z" fill="#FCD34D" opacity="0.6" />
    <circle cx="82" cy="130" r="5" fill="#FDA4AF" opacity="0.7" />
    <circle cx="198" cy="120" r="4" fill="#FECDD3" opacity="0.8" />
    <rect x="95" y="85" width="6" height="6" rx="1" fill="#A78BFA" transform="rotate(15 95 85)" opacity="0.6" />
    <rect x="180" y="90" width="5" height="5" rx="1" fill="#34D399" transform="rotate(-20 180 90)" opacity="0.6" />
    <rect x="100" y="115" width="4" height="4" rx="1" fill="#FCD34D" transform="rotate(30 100 115)" opacity="0.7" />
    <rect x="185" y="140" width="5" height="5" rx="1" fill="#F472B6" transform="rotate(-10 185 140)" opacity="0.6" />
  </svg>
);

// ─── STEPS CONFIG ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'welcome',
    illustration: <IllustrationSecurity />,
    badge: 'Добро пожаловать',
    badgeColor: '#2563EB',
    badgeBg: '#EFF6FF',
    title: 'SaqBol — платформа\nцифровой безопасности',
    description: 'Интерактивные курсы, симуляции реальных атак и AI-помощник. Всё что нужно для защиты себя и своей команды.',
    cta: 'Начать знакомство',
    highlight: null,
  },
  {
    id: 'learning',
    illustration: <IllustrationLearning />,
    badge: 'Форматы обучения',
    badgeColor: '#059669',
    badgeBg: '#F0FDF4',
    title: 'Учитесь через\nпрактику, не лекции',
    description: 'Видео, живой код прямо в браузере, симуляции фишинга и тесты — каждый шаг закрепляет знания действием.',
    cta: 'Понятно',
    highlight: [
      { icon: '🎬', text: 'Видео-уроки' },
      { icon: '💻', text: 'Тренажёр кода' },
      { icon: '🎭', text: 'Симуляции атак' },
      { icon: '📝', text: 'Тесты и квизы' },
    ],
  },
  {
    id: 'ai',
    illustration: <IllustrationAI />,
    badge: 'AI-функции',
    badgeColor: '#D97706',
    badgeBg: '#FFFBEB',
    title: 'Ваш личный\nAI-наставник',
    description: 'Анализирует ваши ошибки, определяет слабые темы и даёт персональные рекомендации что повторить.',
    cta: 'Интересно',
    highlight: null,
  },
  {
    id: 'achieve',
    illustration: <IllustrationAchieve />,
    badge: 'Результат',
    badgeColor: '#E11D48',
    badgeBg: '#FFF1F2',
    title: 'Прогресс который\nможно измерить',
    description: 'Дашборд с вашей статистикой, история квизов, слабые темы — вы всегда знаете насколько выросли.',
    cta: 'Начать обучение',
    isLast: true,
  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function OnboardingTour() {
  const [visible, setVisible]   = useState(false);
  const [step, setStep]         = useState(0);
  const [exiting, setExiting]   = useState(false);
  const [direction, setDirection] = useState(1);
  const [animating, setAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('sq_onboarding_done')) return;
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const close = useCallback((goToCourses = false) => {
    setExiting(true);
    localStorage.setItem('sq_onboarding_done', '1');
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      if (goToCourses) navigate('/courses');
    }, 300);
  }, [navigate]);

  const go = useCallback((dir) => {
    if (animating) return;
    const next = step + dir;
    if (next < 0 || next >= STEPS.length) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 200);
  }, [step, animating]);

  const handleCta = () => {
    if (STEPS[step].isLast) {
      close(true);
    } else {
      go(1);
    }
  };

  if (!visible) return null;

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <>
      <style>{`
        @keyframes ob-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ob-modal-in {
          from { opacity: 0; transform: scale(0.94) translateY(16px) translate(-50%, -50%); }
          to   { opacity: 1; transform: scale(1) translateY(0) translate(-50%, -50%); }
        }
        @keyframes ob-modal-out {
          from { opacity: 1; transform: scale(1) translateY(0) translate(-50%, -50%); }
          to   { opacity: 0; transform: scale(0.96) translateY(8px) translate(-50%, -50%); }
        }
        @keyframes ob-slide-fwd {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ob-slide-back {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ob-illus-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        .ob-backdrop  { animation: ob-backdrop-in .25s ease both; }
        .ob-modal-in  { animation: ob-modal-in .35s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: top left; }
        .ob-modal-out { animation: ob-modal-out .25s ease both; transform-origin: top left;}
        .ob-slide-fwd  { animation: ob-slide-fwd .22s ease both; }
        .ob-slide-back { animation: ob-slide-back .22s ease both; }
        .ob-float { animation: ob-illus-float 4s ease-in-out infinite; }
      `}</style>

      {/* Backdrop */}
      <div
        className="ob-backdrop"
        onClick={() => close()}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal */}
      <div
        className={exiting ? 'ob-modal-out' : 'ob-modal-in'}
        style={{
          position: 'fixed', zIndex: 201,
          top: '50%', left: '50%',
          width: '100%', maxWidth: 420,
          padding: '0 16px',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          background: '#fff',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
          pointerEvents: 'all',
          position: 'relative',
        }}>

          {/* Close */}
          <button
            onClick={() => close()}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              width: 32, height: 32, borderRadius: 10,
              border: 'none', background: 'rgba(0,0,0,0.06)',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#64748B', transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
          >
            <X size={15} />
          </button>

          {/* Progress bar */}
          <div style={{ height: 3, background: '#F1F5F9' }}>
            <div style={{
              height: '100%', background: current.badgeColor,
              width: `${progress}%`,
              transition: 'width .4s cubic-bezier(.4,0,.2,1)',
            }} />
          </div>

          {/* Illustration */}
          <div
            className="ob-float"
            style={{ height: 180, padding: '8px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {current.illustration}
          </div>

          {/* Content */}
          <div
            className={animating ? '' : (direction > 0 ? 'ob-slide-fwd' : 'ob-slide-back')}
            style={{ padding: '0 28px 28px' }}
          >
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 99,
              background: current.badgeBg,
              marginBottom: 12,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: current.badgeColor }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: current.badgeColor, letterSpacing: '0.04em' }}>
                {current.badge}
              </span>
            </div>

            {/* Title */}
            <h2 style={{
              fontSize: 22, fontWeight: 800, color: '#0F172A',
              lineHeight: 1.25, margin: '0 0 12px',
              whiteSpace: 'pre-line',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              {current.title}
            </h2>

            {/* Description */}
            <p style={{
              fontSize: 14, color: '#64748B', lineHeight: 1.65,
              margin: '0 0 20px',
            }}>
              {current.description}
            </p>

            {/* Highlight chips */}
            {current.highlight && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {current.highlight.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 10,
                    background: '#F8FAFC', border: '1px solid #E2E8F0',
                    fontSize: 12, fontWeight: 600, color: '#334155',
                  }}>
                    <span>{h.icon}</span> {h.text}
                  </div>
                ))}
              </div>
            )}

            {/* Step dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
                  style={{
                    height: 6, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: i === step ? current.badgeColor : '#E2E8F0',
                    width: i === step ? 24 : 6,
                    transition: 'all .3s cubic-bezier(.4,0,.2,1)',
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && (
                <button
                  onClick={() => go(-1)}
                  style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    border: '1.5px solid #E2E8F0', background: '#fff',
                    cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#64748B', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff'; }}
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <button
                onClick={handleCta}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: 'none',
                  background: current.badgeColor, color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, transition: 'opacity .15s, transform .1s',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxShadow: `0 4px 16px ${current.badgeColor}40`,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.92'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {current.cta}
                {!current.isLast && <ChevronRight size={16} />}
              </button>
            </div>

            {/* Skip */}
            {!current.isLast && (
              <button
                onClick={() => close()}
                style={{
                  display: 'block', width: '100%', marginTop: 12,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: '#94A3B8', fontFamily: 'inherit',
                  transition: 'color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#64748B'}
                onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
              >
                Пропустить тур
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}