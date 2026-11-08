import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock3, Check, BookOpen, RotateCcw } from 'lucide-react';
import api from '../api';
import { DemoNotice, ExamLoading, formatDate } from './ExamPrimitives';

function AttemptList({ type, c, language }) {
  const [data, setData] = useState({ results: [], next_offset: null });
  const [visible, setVisible] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async (offset = 0) => {
    setLoading(true); setError(false);
    try {
      const response = await api.get('exams/attempts/', { params: { status: type, offset } });
      setData(previous => ({ ...response.data, results: offset ? [...previous.results, ...response.data.results] : response.data.results }));
    } catch { setError(true); } finally { setLoading(false); }
  }, [type]);
  useEffect(() => { load(); }, [load]);
  const more = async () => {
    if (visible >= data.results.length && data.next_offset !== null) await load(data.next_offset);
    setVisible(value => value + 5);
  };
  return <div className="exam-attempt-list">
    {data.results.slice(0, visible).map(attempt => <div className="exam-attempt-row" key={attempt.id}>
      <div><strong>{attempt.configuration.title}</strong><span>{formatDate(type === 'active' ? attempt.started_at : attempt.completed_at, language)}</span></div>
      {type === 'completed' && attempt.result?.grading && <span className="exam-list-score">{attempt.result.grading.earned_points} / {attempt.result.grading.max_points} {c.points}</span>}
      <Link className="exam-button exam-button-quiet" to={'/exams/attempts/' + attempt.id + (type === 'completed' ? '/result' : '')}>{type === 'active' ? c.resume : c.result}<ArrowRight size={16} aria-hidden="true" /></Link>
    </div>)}
    {!loading && !error && !data.results.length && <p className="exam-muted">{type === 'active' ? c.noActive : c.noHistory}</p>}
    {loading && <p role="status" className="exam-muted">{c.load}</p>}
    {error && <div className="exam-notice" role="alert"><p>{c.loadError}</p><button className="exam-button exam-button-quiet" onClick={() => load(data.results.length ? data.next_offset || 0 : 0)}>{c.retry}</button></div>}
    {(visible < data.results.length || data.next_offset !== null) && <button className="exam-button exam-button-quiet" onClick={more} disabled={loading}>{c.more}</button>}
  </div>;
}

export default function ExamSetup({ c, language }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [configurations, setConfigurations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const startIds = useRef(new Map());
  const startBusy = useRef(false);
  const settingsRef = useRef(null);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await api.get('exams/configurations/');
      setConfigurations(data);
      setSelectedId(previous => data.find(item => item.id === previous)?.id || data.find(item => item.id === params.get('configuration') && item.available)?.id || data.find(item => item.available)?.id || data[0]?.id || '');
    } catch { setError(true); } finally { setLoading(false); }
  }, [params]);
  useEffect(() => { load(); }, [load]);
  const selected = configurations.find(config => config.id === selectedId);
  const demo = configurations.find(config => config.is_demo && config.available);
  const formats = configurations.filter(config => !config.is_demo);
  const start = async () => {
    if (startBusy.current || !selected?.available) return;
    startBusy.current = true; setStarting(true); setStartError('');
    if (!startIds.current.has(selected.id)) startIds.current.set(selected.id, crypto.randomUUID());
    try {
      const { data } = await api.post('exams/attempts/', { configuration_id: selected.id, request_id: startIds.current.get(selected.id) });
      navigate('/exams/attempts/' + data.id + (data.status === 'completed' ? '/result' : ''));
    } catch (failure) {
      const detail = failure.response?.data?.configuration_id;
      setStartError(typeof detail === 'string' ? detail : c.startError);
    } finally { startBusy.current = false; setStarting(false); }
  };
  return <div className="exam-page exam-setup">
    <header className="exam-setup-heading"><div><h1>{c.title}</h1><p className="exam-muted">{c.intro}</p></div><button className="exam-button exam-button-primary" onClick={() => { settingsRef.current?.scrollIntoView({ block: 'start' }); settingsRef.current?.focus(); }}>{c.take}<ArrowRight size={18} aria-hidden="true" /></button></header>
    <section className="exam-continue" aria-labelledby="exam-continue-heading"><h2 id="exam-continue-heading"><RotateCcw size={19} aria-hidden="true" />{c.active}</h2><AttemptList type="active" c={c} language={language} /></section>
    <section ref={settingsRef} tabIndex={-1} className="exam-settings" aria-labelledby="exam-format-heading">
      <h2 id="exam-format-heading">{c.format}</h2>
      {loading ? <ExamLoading label={c.load} /> : error ? <div className="exam-notice" role="alert"><p>{c.loadError}</p><button className="exam-button" onClick={load}>{c.retry}</button></div> : <>
        <fieldset className="exam-format-grid"><legend className="exam-sr-only">{c.format}</legend>{formats.map(config => <label key={config.id} className={'exam-format-option ' + (selectedId === config.id ? 'is-selected' : '') + (!config.available ? ' is-unavailable' : '')}>
          <div className="exam-format-title"><input type="radio" name="exam-format" value={config.id} checked={selectedId === config.id} disabled={!config.available || starting} onChange={() => { setSelectedId(config.id); setStartError(''); }} /><strong>{config.format === 'profile' ? c.profile : c.scientific}</strong></div>
          <div className="exam-format-metrics"><span>{config.total_questions} {c.questions}</span><span>{config.max_points} {c.points}</span><span><Clock3 size={15} aria-hidden="true" />{config.duration_seconds / 60} {c.minutes}</span></div>
          <p className="exam-muted">{config.sections.map(section => section.title).join(' · ')}</p>
          {!config.available && <p className="exam-unavailable"><strong>{c.unavailable}.</strong> {config.unavailable_reason}</p>}
        </label>)}</fieldset>
        {demo && <div className="exam-demo-choice"><div><strong>{demo.title}</strong><p>{c.demoNotice} {c.noTimer}.</p></div><button className="exam-button" aria-pressed={selectedId === demo.id} disabled={starting} onClick={() => { setSelectedId(demo.id); setStartError(''); }}>{selectedId === demo.id ? <><Check size={16} aria-hidden="true" />{c.demoChosen}</> : c.chooseDemo}</button></div>}
        {selected ? <>
          <dl className="exam-configuration-facts"><div><dt>{c.program}</dt><dd>{selected.program.code} · {selected.program.title}</dd></div><div><dt>{c.language}</dt><dd>{selected.language === 'ru' ? c.russian : selected.language}</dd><p>{c.materialsHint}</p></div></dl>
          <section className="exam-start-summary" aria-labelledby="exam-start-heading"><div><h2 id="exam-start-heading">{c.confirm}</h2><p>{selected.title}</p><DemoNotice config={selected} c={c} /></div>
            <div className="exam-summary-sections">{selected.sections.map(section => <div key={section.id}><div><strong>{section.title}</strong><span>{section.response_type === 'single' ? c.singleType : c.multipleType}</span></div><span>{section.question_count} {c.questions}</span><span>{section.max_points} {c.points}</span></div>)}</div>
            <p className="exam-rules">{c.rules} {selected.duration_seconds !== null && c.timerRule}</p>
            {!selected.available && <p className="exam-notice">{selected.unavailable_reason || c.notAvailable}</p>}
            {startError && <p className="exam-notice is-error" role="alert">{startError}</p>}
            <div className="exam-start-actions"><span><Clock3 size={17} aria-hidden="true" />{selected.duration_seconds === null ? c.noTimer : selected.duration_seconds / 60 + ' ' + c.minutes}</span><button className="exam-button exam-button-primary" disabled={starting || !selected.available} onClick={start}>{starting ? c.starting : c.start}<ArrowRight size={18} aria-hidden="true" /></button></div>
          </section>
        </> : <p className="exam-notice">{c.notAvailable}</p>}
      </>}
    </section>
    <details className="exam-history"><summary><BookOpen size={19} aria-hidden="true" />{c.history}</summary><AttemptList type="completed" c={c} language={language} /></details>
  </div>;
}
