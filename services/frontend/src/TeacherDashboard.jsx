import { useState, useEffect, useCallback } from 'react';
import api from './api';
import aiApi from './aiApi';
import { useTranslation } from 'react-i18next'; 
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

//  1. Переводим все константы на CSS-переменные
const BLUE   = 'var(--blue)';
const BLUE_L = 'var(--blue-l)';
const BLUE_D = 'var(--blue-d)';
const GRAY_1 = 'var(--gray-1)';
const GRAY_2 = 'var(--gray-2)';
const GRAY_3 = 'var(--gray-3)';
const GRAY_4 = 'var(--gray-4)';
const GRAY_5 = 'var(--gray-5)';
const GREEN  = 'var(--green)';
const AMBER  = 'var(--amber)';
const RED    = 'var(--red)';
const RED_L  = 'var(--red-l)';
const BORDER = '1px solid var(--border-color)';
const R      = 12;
const SHADOW = 'var(--shadow)';

function Card({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: R, border: BORDER, boxShadow: SHADOW, ...style }}>
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

//  2. Улучшенный Tag
function Tag({ children, type = 'gray' }) {
  const colorMap = {
    gray:  { c: GRAY_2, bg: 'var(--gray-l)' },
    green: { c: GREEN,  bg: 'var(--green-l)' },
    amber: { c: AMBER,  bg: 'var(--amber-l)' },
    red:   { c: RED,    bg: 'var(--red-l)' },
  };
  const { c, bg } = colorMap[type] || colorMap.gray;

  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600,
      background: bg, color: c, border: `1px solid ${bg}`,
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

function WeakTopics({ topics, t }) {
  if (!topics?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      {t('analyticsTeacher.noWeakTopics')}
    </p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {topics.map((item, i) => {
        const c = item.error_rate >= 70 ? RED : item.error_rate >= 40 ? AMBER : GREEN;
        const tagType = item.error_rate >= 70 ? 'red' : item.error_rate >= 40 ? 'amber' : 'green';
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
              <span style={{ fontSize: 13, color: GRAY_2, flex: 1, lineHeight: 1.4 }}>
                {item.question_text?.length > 80 ? item.question_text.slice(0, 80) + '…' : item.question_text}
              </span>
              <Tag type={tagType}>{item.error_rate.toFixed(0)}%</Tag>
            </div>
            <Bar2 value={item.error_rate} color={c} />
            <p style={{ fontSize: 11, color: GRAY_3, margin: '4px 0 0' }}>{item.total_answers} {t('analyticsTeacher.answersLabel')}</p>
          </div>
        );
      })}
    </div>
  );
}

function QuizDetail({ quizStats, t }) {
  const [sel, setSel] = useState(0);
  if (!quizStats?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      {t('analyticsTeacher.emptyQuizzes')}
    </p>
  );
  const q = quizStats[sel];
  const pie = [{ name: t('analyticsTeacher.passed'), value: q.pass_rate }, { name: t('analyticsTeacher.failed'), value: 100 - q.pass_rate }];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {quizStats.map((item, i) => (
          <button key={i} onClick={() => setSel(i)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: `1px solid ${sel === i ? BLUE : GRAY_5}`,
            background: sel === i ? BLUE_L : 'var(--card-bg)',
            color: sel === i ? BLUE : GRAY_2,
            cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
          }}>{item.quiz_title?.slice(0, 22) || `${t('analyticsTeacher.quizLabel')} ${i + 1}`}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: t('analyticsTeacher.attemptsLabel'), value: q.total_attempts },
          { label: t('analyticsTeacher.avgScore'), value: `${q.avg_score?.toFixed(1)}%` },
          { label: t('analyticsTeacher.passed70Label'), value: `${q.pass_rate?.toFixed(1)}%` },
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
        <WeakTopics topics={q.weak_topics} t={t} />
      </div>
    </div>
  );
}

function ScenarioStats({ stats, t }) {
  if (!stats?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      {t('analyticsTeacher.emptyScenarios')}
    </p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {stats.map((s, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: GRAY_1, margin: 0 }}>{s.scenario_topic || t('analyticsTeacher.scenarioDefault')}</p>
              <p style={{ fontSize: 11, color: GRAY_3, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.scenario_type === 'chat' ? t('analyticsTeacher.chatSimulation') : t('analyticsTeacher.emailPhishing')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Tag type="gray">{s.total_attempts}</Tag>
              <Tag type={s.pass_rate >= 70 ? 'green' : 'red'}>{s.pass_rate}%</Tag>
            </div>
          </div>
          <Bar2 value={s.pass_rate} color={s.pass_rate >= 70 ? GREEN : AMBER} />
          {s.hardest_steps?.length > 0 && (
            <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${GRAY_5}` }}>
              {s.hardest_steps.map((step, j) => (
                <p key={j} style={{ fontSize: 12, color: GRAY_2, margin: '3px 0' }}>
                  <span style={{ color: RED, fontWeight: 700 }}>{step.error_rate}%</span>
                  {' — '}
                  {step.message_text?.slice(0, 60) || `${t('analyticsTeacher.stepDefault')} ${step.step_index}`}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AIAnalysis({ dashData, t }) {
  const { i18n } = useTranslation();
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
        course_title: t('analyticsTeacher.currentCourse'),
        weak_topics: allWeak.slice(0, 5).map(item => ({ question_text: item.question_text, error_rate: item.error_rate, total_answers: item.total_answers })),
        hardest_scenario_steps: allSteps.slice(0, 3).map(s => ({ message_text: s.message_text || '', error_rate: s.error_rate })),
        avg_quiz_score: dashData.avg_quiz_score || 0,
        total_students: dashData.total_students || 0,
        language: i18n.language?.split('-')[0] || 'ru',
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || t('analyticsTeacher.aiErrorDefault'));
    } finally { setLoading(false); }
  }, [dashData, t, i18n.language]);

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
        <div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: BLUE, background: BLUE_L, padding: '2px 8px', borderRadius: 4,
            display: 'inline-block', marginBottom: 8,
          }}>{t('analyticsTeacher.aiStudio')}</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: GRAY_1, margin: 0 }}>{t('analyticsTeacher.aiTitle')}</h2>
          <p style={{ fontSize: 13, color: GRAY_3, margin: '4px 0 0' }}>
            {t('analyticsTeacher.aiDesc')}
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
          {loading ? t('analyticsTeacher.btnAnalyze') : result ? t('analyticsTeacher.btnUpdate') : t('analyticsTeacher.btnGet')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: RED_L, borderRadius: 8, fontSize: 13, color: RED }}>{error}</div>
      )}

      {!result && !loading && !error && (
        <div style={{ padding: '28px 24px', textAlign: 'center', background: GRAY_4, borderRadius: 10, border: `1px dashed ${GRAY_5}` }}>
          <p style={{ fontSize: 13, color: GRAY_3, margin: 0 }}>
            {t('analyticsTeacher.aiHint')}
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
  const { t } = useTranslation(); // 🔥 Инициализируем хук
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
      .catch(e => setError(e.response?.data?.detail || t('analyticsTeacher.loadingError')))
      .finally(() => setLoading(false));
  }, [courseId, t]);

  const barData = data?.quiz_stats?.map(q => ({
    name: q.quiz_title?.slice(0, 18) || t('analyticsTeacher.quizLabel'),
    // Динамические ключи для графика (переводятся!)
    [t('analyticsTeacher.avgScore')]: +q.avg_score?.toFixed(1),
    [t('analyticsTeacher.passPercent')]: +q.pass_rate?.toFixed(1),
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
    <div className="dash-container" style={{ maxWidth: 1100, margin: '0 auto', padding: '4px 0 56px', fontFamily: 'inherit' }}>
      
      {/* CSS БЛОК ДЛЯ ТЕМНОЙ ТЕМЫ */}
      <style>{`
        .dash-container {
          --blue: #2563EB;
          --blue-l: #EFF6FF;
          --blue-d: #1D4ED8;
          --gray-1: #0F172A;
          --gray-2: #475569;
          --gray-3: #94A3B8;
          --gray-4: #F8FAFC;
          --gray-5: #E2E8F0;
          --gray-l: rgba(71, 85, 105, 0.1);
          --green: #059669;
          --green-l: rgba(5, 150, 105, 0.12);
          --amber: #D97706;
          --amber-l: rgba(217, 119, 6, 0.12);
          --red: #DC2626;
          --red-l: #FEF2F2;
          --card-bg: #ffffff;
          --border-color: #E2E8F0;
          --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
        }

        [data-theme='dark'] .dash-container {
          --blue: #3B82F6;
          --blue-l: rgba(59, 130, 246, 0.15);
          --blue-d: #60A5FA;
          --gray-1: #F1F5F9;
          --gray-2: #94A3B8;
          --gray-3: #64748B;
          --gray-4: rgba(255, 255, 255, 0.04);
          --gray-5: rgba(255, 255, 255, 0.1);
          --gray-l: rgba(148, 163, 184, 0.15);
          --green: #10B981;
          --green-l: rgba(16, 185, 129, 0.15);
          --amber: #F59E0B;
          --amber-l: rgba(245, 158, 11, 0.15);
          --red: #EF4444;
          --red-l: rgba(239, 68, 68, 0.15);
          --card-bg: #1E2028;
          --border-color: rgba(255, 255, 255, 0.08);
          --shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GRAY_3, margin: '0 0 6px' }}>
            {t('analyticsTeacher.title')}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: GRAY_1, margin: 0 }}>
            {t('analyticsTeacher.courseResults')}
          </h1>
        </div>
        {courses.length > 0 && (
          <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{
            padding: '8px 14px', borderRadius: 10, border: BORDER, fontSize: 13,
            color: GRAY_1, background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: 500, outline: 'none',
          }}>
            <option value=''>{t('analyticsTeacher.allCourses')}</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label={t('analyticsTeacher.students')} value={data?.total_students ?? '—'} accent={BLUE} />
        <StatCard label={t('analyticsTeacher.quizAttempts')} value={data?.total_quiz_attempts ?? '—'} accent='#6366F1' />
        <StatCard label={t('analyticsTeacher.scenarioAttempts')} value={data?.total_scenario_attempts ?? '—'} accent={AMBER} />
        <StatCard label={t('analyticsTeacher.avgScore')} value={data?.avg_quiz_score != null ? `${data.avg_quiz_score.toFixed(1)}%` : '—'} accent={data?.avg_quiz_score >= 70 ? GREEN : RED} />
      </div>

      {barData.length > 0 && (
        <Card style={{ padding: 24, marginBottom: 18 }}>
          <SectionHeader title={t('analyticsTeacher.comparisonTitle')} subtitle={t('analyticsTeacher.comparisonSubtitle')} />
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRAY_5} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: GRAY_3 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fontSize: 12, fill: GRAY_3 }} unit="%" axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: 10, border: BORDER, background: 'var(--card-bg)', color: GRAY_1, fontSize: 12, boxShadow: SHADOW }} 
                itemStyle={{ color: GRAY_1 }}
                formatter={v => `${v}%`} 
              />
              {/* Используем переменные перевода в ключах графика */}
              <Bar dataKey={t('analyticsTeacher.avgScore')} fill={BLUE} radius={[4,4,0,0]} />
              <Bar dataKey={t('analyticsTeacher.passPercent')} fill={GREEN} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <Card style={{ padding: 24 }}>
          <SectionHeader title={t('analyticsTeacher.quizDetailsTitle')} subtitle={t('analyticsTeacher.quizDetailsSubtitle')} />
          <QuizDetail quizStats={data?.quiz_stats} t={t} />
        </Card>
        <Card style={{ padding: 24 }}>
          <SectionHeader title={t('analyticsTeacher.scenariosTitle')} subtitle={t('analyticsTeacher.scenariosSubtitle')} />
          <ScenarioStats stats={data?.scenario_stats} t={t} />
        </Card>
      </div>

      <AIAnalysis dashData={data} t={t} />
    </div>
  );
}