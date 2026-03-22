import { useState, useEffect, useCallback } from 'react';
import api from './api';
import aiApi from './aiApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const BLUE   = '#2563EB';
const BLUE_L = '#EFF6FF';
const BLUE_D = '#1D4ED8';
const GRAY_1 = '#0F172A';
const GRAY_2 = '#475569';
const GRAY_3 = '#94A3B8';
const GRAY_4 = '#F8FAFC';
const GRAY_5 = '#E2E8F0';
const GREEN  = '#059669';
const AMBER  = '#D97706';
const RED    = '#DC2626';
const RED_L  = '#FEF2F2';
const BORDER = '1px solid #E2E8F0';
const R      = 12;
const SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)';

function Card({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', borderRadius: R, border: BORDER, boxShadow: SHADOW, ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: GRAY_1, margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 12, color: GRAY_3, margin: '3px 0 0' }}>{subtitle}</p>}
    </div>
  );
}

function Tag({ children, color = GRAY_2 }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600,
      background: color + '12', color, border: `1px solid ${color}22`,
    }}>{children}</span>
  );
}

function StatCard({ label, value, accent = BLUE }) {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: GRAY_1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: GRAY_2 }}>{label}</div>
      <div style={{ marginTop: 14, height: 2, background: GRAY_5, borderRadius: 99 }}>
        <div style={{ width: 28, height: 2, background: accent, borderRadius: 99 }} />
      </div>
    </Card>
  );
}

function Bar2({ value, color = BLUE }) {
  return (
    <div style={{ height: 4, background: GRAY_5, borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s ease' }} />
    </div>
  );
}

function WeakTopics({ topics }) {
  if (!topics?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      Слабых тем не выявлено
    </p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {topics.map((t, i) => {
        const c = t.error_rate >= 70 ? RED : t.error_rate >= 40 ? AMBER : GREEN;
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
              <span style={{ fontSize: 13, color: GRAY_2, flex: 1, lineHeight: 1.4 }}>
                {t.question_text?.length > 80 ? t.question_text.slice(0, 80) + '…' : t.question_text}
              </span>
              <Tag color={c}>{t.error_rate.toFixed(0)}%</Tag>
            </div>
            <Bar2 value={t.error_rate} color={c} />
            <p style={{ fontSize: 11, color: GRAY_3, margin: '4px 0 0' }}>{t.total_answers} ответов</p>
          </div>
        );
      })}
    </div>
  );
}

function QuizDetail({ quizStats }) {
  const [sel, setSel] = useState(0);
  if (!quizStats?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      Данных по квизам пока нет
    </p>
  );
  const q = quizStats[sel];
  const pie = [{ name: 'Прошли', value: q.pass_rate }, { name: 'Нет', value: 100 - q.pass_rate }];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {quizStats.map((q, i) => (
          <button key={i} onClick={() => setSel(i)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${sel === i ? BLUE : GRAY_5}`,
            background: sel === i ? BLUE_L : '#fff',
            color: sel === i ? BLUE : GRAY_2,
            cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
          }}>{q.quiz_title?.slice(0, 22) || `Квиз ${i + 1}`}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Попыток', value: q.total_attempts },
          { label: 'Средний балл', value: `${q.avg_score?.toFixed(1)}%` },
          { label: 'Прошли ≥70%', value: `${q.pass_rate?.toFixed(1)}%` },
        ].map((m, i) => (
          <div key={i} style={{ padding: '10px 12px', background: GRAY_4, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: GRAY_1 }}>{m.value}</div>
            <div style={{ fontSize: 11, color: GRAY_3, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, alignItems: 'start' }}>
        <ResponsiveContainer width={140} height={120}>
          <PieChart>
            <Pie data={pie} cx={60} cy={55} innerRadius={32} outerRadius={50} dataKey="value" paddingAngle={3}>
              <Cell fill={GREEN} /><Cell fill={GRAY_5} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <WeakTopics topics={q.weak_topics} />
      </div>
    </div>
  );
}

function ScenarioStats({ stats }) {
  if (!stats?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      Данных по сценариям пока нет
    </p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {stats.map((s, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: GRAY_1, margin: 0 }}>{s.scenario_topic || 'Сценарий'}</p>
              <p style={{ fontSize: 11, color: GRAY_3, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.scenario_type === 'chat' ? 'Чат-симуляция' : 'Email-фишинг'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Tag color={GRAY_2}>{s.total_attempts}</Tag>
              <Tag color={s.pass_rate >= 70 ? GREEN : RED}>{s.pass_rate}%</Tag>
            </div>
          </div>
          <Bar2 value={s.pass_rate} color={s.pass_rate >= 70 ? GREEN : AMBER} />
          {s.hardest_steps?.length > 0 && (
            <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${GRAY_5}` }}>
              {s.hardest_steps.map((step, j) => (
                <p key={j} style={{ fontSize: 12, color: GRAY_2, margin: '3px 0' }}>
                  <span style={{ color: RED, fontWeight: 700 }}>{step.error_rate}%</span>
                  {' — '}
                  {step.message_text?.slice(0, 60) || `Шаг ${step.step_index}`}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AIAnalysis({ dashData }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    if (!dashData) return;
    setLoading(true); setError(null);
    try {
      const allWeak  = dashData.quiz_stats?.flatMap(q => q.weak_topics || []) || [];
      const allSteps = dashData.scenario_stats?.flatMap(s => s.hardest_steps || []) || [];
      const res = await aiApi.post('analytics/insights/teacher/', {
        course_title: 'Текущий курс',
        weak_topics: allWeak.slice(0, 5).map(t => ({ question_text: t.question_text, error_rate: t.error_rate, total_answers: t.total_answers })),
        hardest_scenario_steps: allSteps.slice(0, 3).map(s => ({ message_text: s.message_text || '', error_rate: s.error_rate })),
        avg_quiz_score: dashData.avg_quiz_score || 0,
        total_students: dashData.total_students || 0,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Сервис временно недоступен');
    } finally { setLoading(false); }
  }, [dashData]);

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
        <div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: BLUE, background: BLUE_L, padding: '2px 8px', borderRadius: 4,
            display: 'inline-block', marginBottom: 8,
          }}>AI Студия</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: GRAY_1, margin: 0 }}>Анализ курса</h2>
          <p style={{ fontSize: 13, color: GRAY_3, margin: '4px 0 0' }}>
            ИИ изучит результаты и подготовит рекомендации по улучшению
          </p>
        </div>
        <button onClick={run} disabled={loading} style={{
          padding: '10px 20px', borderRadius: R, border: 'none', flexShrink: 0,
          background: loading ? GRAY_4 : BLUE, color: loading ? GRAY_3 : '#fff',
          fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background .2s',
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = BLUE_D; }}
        onMouseLeave={e => { if (!loading) e.currentTarget.style.background = BLUE; }}>
          {loading ? 'Анализирую...' : result ? 'Обновить' : 'Запустить анализ'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: RED_L, borderRadius: 8, fontSize: 13, color: RED }}>{error}</div>
      )}

      {!result && !loading && !error && (
        <div style={{ padding: '28px 24px', textAlign: 'center', background: GRAY_4, borderRadius: 10, border: `1px dashed ${GRAY_5}` }}>
          <p style={{ fontSize: 13, color: GRAY_3, margin: 0 }}>
            Нажмите «Запустить анализ» — ИИ изучит данные и даст конкретные рекомендации
          </p>
        </div>
      )}

      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.summary && (
            <div style={{ padding: '12px 16px', background: BLUE_L, borderRadius: 8, fontSize: 13, color: '#1E40AF', borderLeft: `3px solid ${BLUE}` }}>
              {result.summary}
            </div>
          )}
          {result.recommendations?.map((rec, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: 16, border: BORDER, borderRadius: R }}>
              <div style={{
                minWidth: 26, height: 26, borderRadius: 8, background: BLUE_L, color: BLUE,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0,
              }}>{rec.priority || i + 1}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: GRAY_1, margin: '0 0 4px' }}>{rec.topic}</p>
                <p style={{ fontSize: 13, color: GRAY_2, margin: '0 0 6px' }}>{rec.issue}</p>
                <p style={{ fontSize: 13, color: GREEN, fontWeight: 600, margin: 0 }}>{rec.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function TeacherDashboard() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses]   = useState([]);

  useEffect(() => {
    api.get('courses/?my=true').then(r => setCourses(r.data?.results || r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get(`analytics/teacher/dashboard/${courseId ? `?course_id=${courseId}` : ''}`)
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(e.response?.data?.detail || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const barData = data?.quiz_stats?.map(q => ({
    name: q.quiz_title?.slice(0, 18) || 'Квиз',
    'Средний балл': +q.avg_score?.toFixed(1),
    'Прошли %': +q.pass_rate?.toFixed(1),
  })) || [];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
      <div style={{ width: 28, height: 28, border: `2px solid ${GRAY_5}`, borderTopColor: BLUE, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <p style={{ color: RED, fontSize: 14, margin: 0 }}>{error}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4px 0 56px', fontFamily: 'inherit' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GRAY_3, margin: '0 0 6px' }}>Аналитика</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: GRAY_1, margin: 0 }}>Результаты курса</h1>
        </div>
        {courses.length > 0 && (
          <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{
            padding: '8px 14px', borderRadius: 10, border: BORDER, fontSize: 13,
            color: GRAY_1, background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: 500, outline: 'none',
          }}>
            <option value=''>Все курсы</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label="Студентов" value={data?.total_students ?? '—'} accent={BLUE} />
        <StatCard label="Попыток квизов" value={data?.total_quiz_attempts ?? '—'} accent='#6366F1' />
        <StatCard label="Попыток сценариев" value={data?.total_scenario_attempts ?? '—'} accent={AMBER} />
        <StatCard label="Средний балл" value={data?.avg_quiz_score != null ? `${data.avg_quiz_score.toFixed(1)}%` : '—'} accent={data?.avg_quiz_score >= 70 ? GREEN : RED} />
      </div>

      {barData.length > 0 && (
        <Card style={{ padding: 24, marginBottom: 18 }}>
          <SectionHeader title="Сравнение квизов" subtitle="Средний балл и процент прохождения" />
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY_5} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: GRAY_3 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fontSize: 12, fill: GRAY_3 }} unit="%" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: BORDER, fontSize: 12, boxShadow: SHADOW }} formatter={v => `${v}%`} />
              <Bar dataKey="Средний балл" fill={BLUE} radius={[4,4,0,0]} />
              <Bar dataKey="Прошли %" fill={GREEN} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <Card style={{ padding: 24 }}>
          <SectionHeader title="Детализация квизов" subtitle="Результаты по вопросам и слабые темы" />
          <QuizDetail quizStats={data?.quiz_stats} />
        </Card>
        <Card style={{ padding: 24 }}>
          <SectionHeader title="Сценарии кибербезопасности" subtitle="Проблемные шаги" />
          <ScenarioStats stats={data?.scenario_stats} />
        </Card>
      </div>

      <AIAnalysis dashData={data} />
    </div>
  );
}