import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function ExamDialog({ open, title, onClose, children, locked = false, closeLabel = 'Закрыть', className = '' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return <dialog ref={ref} className={'exam-dialog ' + className} aria-labelledby="exam-dialog-title" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(item => item.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); if (!locked) closeRef.current(); }}>
    <div className="exam-dialog-heading"><h2 id="exam-dialog-title">{title}</h2><button type="button" className="exam-icon-button" onClick={onClose} disabled={locked} aria-label={closeLabel}><X size={20} aria-hidden="true" /></button></div>
    {children}
  </dialog>;
}

export function ExamText({ text, className = '' }) {
  const value = String(text || '');
  const parts = value.split(/(```[\s\S]*?```)/g);
  return <div className={'exam-text ' + className}>{parts.map((part, index) => {
    if (!part) return null;
    const fenced = part.startsWith('```');
    const code = fenced ? part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '') : part;
    const isCode = fenced || /^\s*(SELECT\b|WITH\b|INSERT\b|UPDATE\b|DELETE\b|CREATE\b|ALTER\b|EXPLAIN\b|#include\b|int main\b)/i.test(part);
    if (isCode) return <pre key={index} tabIndex={0}><code>{code}</code></pre>;
    // Plain-text legacy questions may have a SQL statement after their prose.
    // Keep it escaped and preserve line breaks without interpreting any HTML.
    const sql = part.match(/(^|\n)((?:SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|EXPLAIN)\b[\s\S]*?(?:;(?=\r?\n|$)|$))/i);
    if (sql) {
      const start = sql.index + sql[1].length;
      return <div key={index}>{part.slice(0, start)}<pre tabIndex={0}><code>{sql[2]}</code></pre>{part.slice(start + sql[2].length)}</div>;
    }
    return <div key={index}>{part}</div>;
  })}</div>;
}

export function ExamLoading({ label }) {
  return <div className="exam-loading" role="status"><p>{label}</p><div /><div /><div /></div>;
}

export function DemoNotice({ config, c }) {
  return config?.is_demo ? <p className="exam-demo"><strong>{c.demo}.</strong> {c.demoNotice}</p> : null;
}

export function formatDate(value, language) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(language || 'ru', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' }).format(date);
}
