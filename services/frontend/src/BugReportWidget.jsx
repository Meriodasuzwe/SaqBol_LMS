import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { buildExamReportContext, submitBugReport } from './exams/examReport';
import api from './api';
import { Bug, X, Upload, Trash2, Send, ChevronDown, CheckCircle } from 'lucide-react';

const CATEGORIES = [
    { value: 'ui', label: 'Интерфейс' },
    { value: 'functionality', label: 'Функциональность' },
    { value: 'performance', label: 'Производительность' },
    { value: 'payment', label: 'Оплата' },
    { value: 'other', label: 'Другое' },
];

const MAX_SCREENSHOTS = 5;
const MAX_FILE_SIZE_MB = 5;

const LegacyBugReportWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState('form'); // 'form' | 'success'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const [form, setForm] = useState({
        title: '',
        category: 'other',
        description: '',
        page_url: window.location.href,
    });
    const [errors, setErrors] = useState({});
    const [screenshots, setScreenshots] = useState([]); // [{file, preview}]

    const fileInputRef = useRef(null);
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = theme === 'dark';

    const colors = {
        bg: isDark ? '#1e1e24' : '#ffffff',
        surface: isDark ? '#121216' : '#f8fafc',
        border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        text: isDark ? '#f1f5f9' : '#0f172a',
        muted: isDark ? '#94a3b8' : '#64748b',
        accent: '#ef4444',
        accentLight: isDark ? 'rgba(239,68,68,0.12)' : '#fff5f5',
    };

    const reset = () => {
        setForm({ title: '', category: 'other', description: '', page_url: window.location.href });
        setScreenshots([]);
        setErrors({});
        setStep('form');
    };

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(reset, 300);
    };

    const addFiles = useCallback((files) => {
        const valid = Array.from(files).filter(f => {
            if (!f.type.startsWith('image/')) return false;
            if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) return false;
            return true;
        });

        setScreenshots(prev => {
            const remaining = MAX_SCREENSHOTS - prev.length;
            const toAdd = valid.slice(0, remaining).map(file => ({
                file,
                preview: URL.createObjectURL(file),
                id: Math.random().toString(36).slice(2),
            }));
            return [...prev, ...toAdd];
        });
    }, []);

    const removeScreenshot = (id) => {
        setScreenshots(prev => {
            const removed = prev.find(s => s.id === id);
            if (removed) URL.revokeObjectURL(removed.preview);
            return prev.filter(s => s.id !== id);
        });
    };

    const validate = () => {
        const errs = {};
        if (!form.title.trim()) errs.title = 'Укажите заголовок';
        if (form.title.trim().length > 255) errs.title = 'Не более 255 символов';
        if (!form.description.trim()) errs.description = 'Опишите проблему';
        if (form.description.trim().length < 10) errs.description = 'Минимум 10 символов';
        return errs;
    };

    const handleSubmit = async () => {
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }

        setIsSubmitting(true);
        try {
            await submitBugReport(api, form, screenshots);
            setStep('success');
        } catch (e) {
            setErrors({ submit: 'Не удалось отправить. Попробуйте ещё раз.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputStyle = (hasError) => ({
        width: '100%',
        padding: '10px 14px',
        borderRadius: 12,
        border: `1px solid ${hasError ? '#ef4444' : colors.border}`,
        background: colors.surface,
        color: colors.text,
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s',
    });

    return (
        <>
            {/* Trigger button */}
            <button
                onClick={() => setIsOpen(true)}
                title="Сообщить об ошибке"
                style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 9998,
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: 'none',
                    background: colors.accent,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(239,68,68,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(239,68,68,0.4)'; }}
            >
                <Bug size={22} />
            </button>

            {/* Overlay + Panel */}
            {isOpen && (
                <>
                    <div
                        onClick={handleClose}
                        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
                    />
                    <div style={{
                        position: 'fixed',
                        bottom: 88,
                        right: 24,
                        zIndex: 9999,
                        width: 380,
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        background: colors.bg,
                        borderRadius: 20,
                        border: `1px solid ${colors.border}`,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: colors.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bug size={18} color={colors.accent} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>Сообщить об ошибке</div>
                                    <div style={{ fontSize: 12, color: colors.muted }}>Помогите нам стать лучше</div>
                                </div>
                            </div>
                            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.muted, display: 'flex', padding: 4 }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px' }}>
                            {step === 'success' ? (
                                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <CheckCircle size={48} color="#10b981" style={{ marginBottom: 16 }} />
                                    <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 8 }}>Отправлено!</div>
                                    <div style={{ fontSize: 14, color: colors.muted, marginBottom: 24, lineHeight: 1.6 }}>
                                        Спасибо! Мы получили ваш репорт и постараемся исправить как можно скорее.
                                    </div>
                                    <button onClick={handleClose} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                                        Закрыть
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                                    {/* Title */}
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 700, color: colors.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Заголовок *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Кратко опишите проблему"
                                            value={form.title}
                                            onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setErrors(er => ({ ...er, title: null })); }}
                                            style={inputStyle(errors.title)}
                                        />
                                        {errors.title && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.title}</div>}
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 700, color: colors.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Категория
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={form.category}
                                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                                style={{ ...inputStyle(false), appearance: 'none', paddingRight: 36, cursor: 'pointer' }}
                                            >
                                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                            <ChevronDown size={16} color={colors.muted} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 700, color: colors.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Описание *
                                        </label>
                                        <textarea
                                            rows={4}
                                            placeholder="Что произошло? Как воспроизвести?"
                                            value={form.description}
                                            onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: null })); }}
                                            style={{ ...inputStyle(errors.description), resize: 'vertical', minHeight: 80 }}
                                        />
                                        {errors.description && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.description}</div>}
                                    </div>

                                    {/* Screenshots */}
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 700, color: colors.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Скриншоты ({screenshots.length}/{MAX_SCREENSHOTS})
                                        </label>

                                        {/* Drop zone */}
                                        {screenshots.length < MAX_SCREENSHOTS && (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
                                                style={{
                                                    border: `2px dashed ${isDragging ? colors.accent : colors.border}`,
                                                    borderRadius: 12,
                                                    padding: '16px',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    background: isDragging ? colors.accentLight : colors.surface,
                                                    transition: 'all 0.2s',
                                                    marginBottom: screenshots.length ? 10 : 0,
                                                }}
                                            >
                                                <Upload size={20} color={isDragging ? colors.accent : colors.muted} style={{ marginBottom: 6 }} />
                                                <div style={{ fontSize: 13, color: colors.muted }}>
                                                    Перетащите или <span style={{ color: colors.accent, fontWeight: 600 }}>выберите файлы</span>
                                                </div>
                                                <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>PNG, JPG до {MAX_FILE_SIZE_MB}MB</div>
                                            </div>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />

                                        {/* Previews */}
                                        {screenshots.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                {screenshots.map(s => (
                                                    <div key={s.id} style={{ position: 'relative', width: 72, height: 56, borderRadius: 8, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                                                        <img src={s.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <button
                                                            onClick={() => removeScreenshot(s.id)}
                                                            style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Submit error */}
                                    {errors.submit && (
                                        <div style={{ padding: '10px 14px', borderRadius: 10, background: colors.accentLight, color: colors.accent, fontSize: 13 }}>
                                            {errors.submit}
                                        </div>
                                    )}

                                    {/* Submit button */}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: 14,
                                            border: 'none',
                                            background: isSubmitting ? colors.muted : colors.accent,
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: 15,
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8,
                                            fontFamily: 'inherit',
                                            transition: 'background 0.2s',
                                        }}
                                    >
                                        <Send size={16} />
                                        {isSubmitting ? 'Отправляем...' : 'Отправить репорт'}
                                    </button>

                                    <div style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>
                                        Страница: <span style={{ color: colors.text }}>{form.page_url.replace(/https?:\/\/[^/]+/, '')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
};


const examReportCopy = {
  ru: {
    trigger: 'Сообщить об ошибке', title: 'Ошибка в вопросе',
    help: 'Опишите неточность. Номер вопроса будет приложен автоматически. Ответ в тесте сохранится.',
    subject: 'Краткое описание', description: 'Что нужно проверить?',
    placeholder: 'Например, не отображается часть условия или вариант ответа.',
    send: 'Отправить сообщение', sending: 'Отправляем…', close: 'Закрыть',
    success: 'Сообщение отправлено', thanks: 'Мы получили описание и идентификатор вопроса.',
    invalid: 'Укажите заголовок (до 255 символов) и описание не короче 10 символов.',
    failed: 'Не удалось отправить сообщение. Текст сохранён — попробуйте ещё раз.',
  },
  kk: {
    trigger: 'Қате туралы хабарлау', title: 'Сұрақтағы қате',
    help: 'Қатені сипаттаңыз. Сұрақ нөмірі автоматты түрде қосылады. Тесттегі жауабыңыз сақталады.',
    subject: 'Қысқаша сипаттама', description: 'Нені тексеру керек?',
    placeholder: 'Мысалы, шарттың немесе жауап нұсқасының бір бөлігі көрсетілмейді.',
    send: 'Хабарлама жіберу', sending: 'Жіберілуде…', close: 'Жабу',
    success: 'Хабарлама жіберілді', thanks: 'Сипаттама мен сұрақ идентификаторы алынды.',
    invalid: 'Тақырыпты (255 таңбаға дейін) және кемінде 10 таңбалы сипаттаманы енгізіңіз.',
    failed: 'Хабарлама жіберілмеді. Мәтін сақталды — қайталап көріңіз.',
  },
  en: {
    trigger: 'Report a question', title: 'Question issue',
    help: 'Describe the issue. The question ID is attached automatically. Your exam answer stays in place.',
    subject: 'Short description', description: 'What should we check?',
    placeholder: 'For example, part of the question or an answer option is missing.',
    send: 'Send report', sending: 'Sending…', close: 'Close',
    success: 'Report sent', thanks: 'We received your description and the question ID.',
    invalid: 'Enter a title (up to 255 characters) and a description of at least 10 characters.',
    failed: 'The report could not be sent. Your text is still here — please retry.',
  },
};

function ExamQuestionReport({ context }) {
  const { i18n } = useTranslation();
  const copy = examReportCopy[i18n.language?.split('-')[0]] || examReportCopy.ru;
  const dialog = useRef(null);
  const trigger = useRef(null);
  const fieldId = useId();
  const sendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [reportContext, setReportContext] = useState(null);
  const [form, setForm] = useState({ title: '', description: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  const openReport = () => {
    setReportContext(buildExamReportContext(context));
    setForm({ title: '', description: '' });
    setError('');
    setSent(false);
    setOpen(true);
  };
  const closeReport = () => {
    if (!sendingRef.current) dialog.current.close();
  };
  const submit = async event => {
    event.preventDefault();
    if (sendingRef.current) return;
    if (!form.title.trim() || form.title.trim().length > 255 || form.description.trim().length < 10) {
      setError(copy.invalid);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      await submitBugReport(api, {
        ...form, category: 'functionality', page_url: window.location.origin + reportContext.path,
      }, [], reportContext);
      setSent(true);
    } catch {
      setError(copy.failed);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return <>
    <button ref={trigger} type="button" className="btn btn-ghost btn-sm exam-report-trigger" onClick={openReport}>
      <Bug size={16} aria-hidden="true" />{copy.trigger}
    </button>
    <dialog ref={dialog} className="modal exam-report-dialog" aria-labelledby={`${fieldId}-heading`}
      onCancel={event => { if (sendingRef.current) event.preventDefault(); }}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      onClick={event => { if (event.target === event.currentTarget) closeReport(); }}>
      <div className="modal-box bg-base-100 text-base-content max-w-lg max-h-[85dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id={`${fieldId}-heading`} className="text-xl font-semibold">{sent ? copy.success : copy.title}</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label={copy.close} disabled={sending} onClick={closeReport}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {sent ? <div role="status">
          <p className="mb-6">{copy.thanks}</p>
          <button type="button" className="btn btn-primary" onClick={closeReport}>{copy.close}</button>
        </div> : <form onSubmit={submit}>
          <p className="text-sm leading-relaxed mb-5">{copy.help}</p>
          <label htmlFor={`${fieldId}-title`} className="block font-medium mb-2">{copy.subject}</label>
          <input id={`${fieldId}-title`} autoFocus type="text" required maxLength={255} disabled={sending}
            className="input input-bordered w-full mb-4" value={form.title}
            onChange={event => setForm(current => ({ ...current, title: event.target.value }))} />
          <label htmlFor={`${fieldId}-description`} className="block font-medium mb-2">{copy.description}</label>
          <textarea id={`${fieldId}-description`} required minLength={10} rows={5} disabled={sending}
            className="textarea textarea-bordered w-full" placeholder={copy.placeholder} value={form.description}
            onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />
          {error && <p role="alert" className="text-error text-sm mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn btn-ghost" disabled={sending} onClick={closeReport}>{copy.close}</button>
            <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? copy.sending : copy.send}</button>
          </div>
        </form>}
      </div>
    </dialog>
  </>;
}

export default function BugReportWidget({ inline = false, context } = {}) {
  return inline ? <ExamQuestionReport context={context} /> : <LegacyBugReportWidget />;
}
