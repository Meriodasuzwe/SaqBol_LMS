import { useState, useEffect, useCallback } from 'react';
import api from './api';
import aiApi from './aiApi';
import { useTranslation } from 'react-i18next'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

//  1. Цвета на CSS-переменных
const BLUE   = 'var(--blue)';
const BLUE_L = 'var(--blue-l)';
const BLUE_D = 'var(--blue-d)';
const GRAY_1 = 'var(--gray-1)';
const GRAY_2 = 'var(--gray-2)';
const GRAY_3 = 'var(--gray-3)';
const GRAY_4 = 'var(--gray-4)';
const GRAY_5 = 'var(--gray-5)';
const GREEN  = 'var(--green)';
const GREEN_L= 'var(--green-l)';
const AMBER  = 'var(--amber)';
const RED    = 'var(--red)';
const RED_L  = 'var(--red-l)';
const PURPLE = 'var(--purple)';
const PURPLE_L = 'var(--purple-l)';
const BORDER = '1px solid var(--border-color)';
const R      = 12;
const SHADOW = 'var(--shadow)';

function Card({ children, style = {} }) {
  return <div style={{ background: 'var(--card-bg)', borderRadius: R, border: BORDER, boxShadow: SHADOW, ...style }}>{children}</div>;
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: GRAY_1, margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 12, color: GRAY_3, margin: '3px 0 0' }}>{subtitle}</p>}
    </div>
  );
}

// 🔥 2. Tag с поддержкой прозрачности
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

function ProgressRing({ value, size = 88, stroke = 7, color = BLUE, label }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (Math.min(100, value) / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={GRAY_5} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset .7s ease' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 15, fontWeight: 800, fill: GRAY_1 }}>
          {value?.toFixed(0)}%
        </text>
      </svg>
      {label && <span style={{ fontSize: 12, color: GRAY_3 }}>{label}</span>}
    </div>
  );
}

function ScoreDot({ score }) {
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : RED;
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 800, color,
    }}>{score?.toFixed(0)}%</div>
  );
}

function QuizHistory({ history, t }) {
  if (!history?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      {t('analyticsStudent.emptyQuizzes')}
    </p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 14px', borderRadius: 10, background: GRAY_4,
          transition: 'background .15s', cursor: 'default',
        }}
        onMouseEnter={e => e.currentTarget.style.background = GRAY_5}
        onMouseLeave={e => e.currentTarget.style.background = GRAY_4}>
          <ScoreDot score={item.score} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: GRAY_1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.quiz_title}
            </p>
            <p style={{ fontSize: 12, color: GRAY_3, margin: '2px 0 0' }}>
              {item.correct_answers}/{item.total_questions} {t('analyticsStudent.correctAnswers')}
              {item.time_spent_seconds > 0 && ` · ${Math.round(item.time_spent_seconds / 60)} ${t('analyticsStudent.min')}`}
            </p>
          </div>
          <p style={{ fontSize: 11, color: GRAY_3, flexShrink: 0 }}>
            {new Date(item.completed_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function ScenarioHistory({ history, t }) {
  if (!history?.length) return (
    <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', padding: '20px 0', margin: 0 }}>
      {t('analyticsStudent.emptyScenarios')}
    </p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.map((item, i) => {
        const tagType = item.result === 'passed' ? 'green' : item.result === 'failed' ? 'red' : 'amber';
        const label = item.result === 'passed' ? t('analyticsStudent.passed') : item.result === 'failed' ? t('analyticsStudent.failed') : t('analyticsStudent.incomplete');
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: GRAY_4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: item.scenario_type === 'chat' ? BLUE_L : PURPLE_L,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: item.scenario_type === 'chat' ? BLUE : PURPLE,
            }}>
              {item.scenario_type === 'chat' ? t('analyticsStudent.chatType') : t('analyticsStudent.emailType')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: GRAY_1, margin: 0 }}>
                {item.scenario_topic || t('analyticsStudent.scenarioDefault')}
              </p>
              <p style={{ fontSize: 12, color: GRAY_3, margin: '2px 0 0' }}>
                {item.success_rate?.toFixed(0)}{t('analyticsStudent.correctSteps')}
              </p>
            </div>
            <Tag type={tagType}>{label}</Tag>
          </div>
        );
      })}
    </div>
  );
}

function WeakTopics({ topics, t }) {
  if (!topics?.length) return (
    <div style={{ padding: '24px', textAlign: 'center', background: GREEN_L, borderRadius: 10 }}>
      <p style={{ fontSize: 13, color: GREEN, fontWeight: 600, margin: 0 }}>
        {t('analyticsStudent.noWeakTopics')}
      </p>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {topics.map((tItem, i) => {
        const c = tItem.error_rate >= 70 ? RED : tItem.error_rate >= 40 ? AMBER : GREEN;
        const tagType = tItem.error_rate >= 70 ? 'red' : tItem.error_rate >= 40 ? 'amber' : 'green';
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
              <span style={{ fontSize: 13, color: GRAY_2, flex: 1, lineHeight: 1.4 }}>
                {tItem.question_text?.length > 90 ? tItem.question_text.slice(0, 90) + '…' : tItem.question_text}
              </span>
              <Tag type={tagType}>{tItem.error_rate.toFixed(0)}%</Tag>
            </div>
            <div style={{ height: 4, background: GRAY_5, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, tItem.error_rate)}%`, height: '100%', background: c, borderRadius: 99, transition: 'width .5s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AIRecommendations({ data, t }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!data) return;
    setLoading(true); setError(null);
    try {
      const res = await aiApi.post('analytics/insights/student/', {
        avg_quiz_score: data.avg_quiz_score || 0,
        weak_topics: (data.weak_topics || []).slice(0, 5).map(item => ({ question_text: item.question_text, error_rate: item.error_rate, total_answers: item.total_answers })),
        scenario_pass_rate: data.scenario_pass_rate || 0,
        total_quizzes: data.total_quizzes_taken || 0,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || t('analyticsStudent.aiErrorDefault'));
    } finally { setLoading(false); }
  }, [data, t]);

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
        <div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: BLUE, background: BLUE_L, padding: '2px 8px', borderRadius: 4,
            display: 'inline-block', marginBottom: 8,
          }}>{t('analyticsStudent.aiStudio')}</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: GRAY_1, margin: 0 }}>{t('analyticsStudent.aiTitle')}</h2>
          <p style={{ fontSize: 13, color: GRAY_3, margin: '4px 0 0' }}>
            {t('analyticsStudent.aiDesc')}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          padding: '10px 20px', borderRadius: R, border: 'none', flexShrink: 0,
          background: loading ? GRAY_4 : BLUE, color: loading ? GRAY_3 : '#fff',
          fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background .2s',
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = BLUE_D; }}
        onMouseLeave={e => { if (!loading) e.currentTarget.style.background = BLUE; }}>
          {loading ? t('analyticsStudent.btnAnalyze') : result ? t('analyticsStudent.btnUpdate') : t('analyticsStudent.btnGet')}
        </button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: RED_L, borderRadius: 8, fontSize: 13, color: RED }}>{error}</div>}

      {!result && !loading && !error && (
        <div style={{ padding: '28px 24px', textAlign: 'center', background: GRAY_4, borderRadius: 10, border: `1px dashed ${GRAY_5}` }}>
          <p style={{ fontSize: 13, color: GRAY_3, margin: 0 }}>
            {t('analyticsStudent.aiHint')}
          </p>
        </div>
      )}

      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.strengths && (
            <div style={{ padding: '12px 16px', background: GREEN_L, borderRadius: 8, fontSize: 13, color: 'var(--green-d, #065F46)', borderLeft: `3px solid ${GREEN}` }}>
              {result.strengths}
            </div>
          )}
          {result.recommendations?.map((rec, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: 16, border: BORDER, borderRadius: R }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: GRAY_4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GRAY_3} strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: GRAY_1, margin: '0 0 4px' }}>{rec.topic}</p>
                <p style={{ fontSize: 13, color: GRAY_2, margin: 0 }}>{rec.tip}</p>
              </div>
            </div>
          ))}
          {result.motivation && (
            <div style={{ padding: '12px 16px', background: GRAY_4, borderRadius: 8, fontSize: 13, color: GRAY_2, textAlign: 'center', fontStyle: 'italic' }}>
              {result.motivation}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function StudentDashboard() {
  const { t } = useTranslation(); // 🔥 Инициализируем хук перевода
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [tab, setTab]       = useState('quizzes');

  useEffect(() => {
    api.get('analytics/student/dashboard/')
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(e.response?.data?.detail || t('analyticsStudent.loadingError')))
      .finally(() => setLoading(false));
  }, [t]);

  const lineData = data?.quiz_history?.slice().reverse().map((item, i) => ({
    name: `#${i + 1}`,
    score: item.score,
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

  const TABS = [
    { key: 'quizzes',   label: t('analyticsStudent.tabQuizzes') },
    { key: 'scenarios', label: t('analyticsStudent.tabScenarios') },
    { key: 'weak',      label: t('analyticsStudent.tabWeak') },
  ];

  return (
    <div className="dash-container" style={{ maxWidth: 980, margin: '0 auto', padding: '4px 0 56px', fontFamily: 'inherit' }}>

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
          --green-d: #065F46;
          --amber: #D97706;
          --amber-l: rgba(217, 119, 6, 0.12);
          --red: #DC2626;
          --red-l: #FEF2F2;
          --purple: #7C3AED;
          --purple-l: #F5F3FF;
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
          --green-d: #34D399;
          --amber: #F59E0B;
          --amber-l: rgba(245, 158, 11, 0.15);
          --red: #EF4444;
          --red-l: rgba(239, 68, 68, 0.15);
          --purple: #A78BFA;
          --purple-l: rgba(139, 92, 246, 0.15);
          --card-bg: #1E2028;
          --border-color: rgba(255, 255, 255, 0.08);
          --shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GRAY_3, margin: '0 0 6px' }}>
          {t('analyticsStudent.title')}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: GRAY_1, margin: 0 }}>
          {t('analyticsStudent.myProgress')}
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard label={t('analyticsStudent.quizzesTaken')} value={data?.total_quizzes_taken ?? 0} accent={BLUE} />
        <StatCard label={t('analyticsStudent.avgScore')} value={data?.avg_quiz_score != null ? `${data.avg_quiz_score.toFixed(1)}%` : '—'} accent={data?.avg_quiz_score >= 70 ? GREEN : RED} />
        <StatCard label={t('analyticsStudent.scenariosTaken')} value={data?.total_scenarios_taken ?? 0} accent={AMBER} />
        <StatCard label={t('analyticsStudent.scenarioPassRate')} value={data?.scenario_pass_rate != null ? `${data.scenario_pass_rate.toFixed(1)}%` : '—'} accent={data?.scenario_pass_rate >= 70 ? GREEN : RED} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, marginBottom: 18, alignItems: 'stretch' }}>
        <Card style={{ padding: '20px 28px', display: 'flex', gap: 28, alignItems: 'center' }}>
          <ProgressRing value={data?.avg_quiz_score ?? 0} color={data?.avg_quiz_score >= 70 ? GREEN : AMBER} label={t('analyticsStudent.quizzesLabel')} />
          <ProgressRing value={data?.scenario_pass_rate ?? 0} color={data?.scenario_pass_rate >= 70 ? BLUE : RED} label={t('analyticsStudent.scenariosLabel')} />
        </Card>

        <Card style={{ padding: 24 }}>
          {lineData.length > 1 ? (
            <>
              <SectionHeader title={t('analyticsStudent.chartTitle')} subtitle={t('analyticsStudent.chartSubtitle')} />
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRAY_5} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: GRAY_3 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fontSize: 11, fill: GRAY_3 }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 10, border: BORDER, background: 'var(--card-bg)', color: GRAY_1, fontSize: 12, boxShadow: SHADOW }} 
                    itemStyle={{ color: GRAY_1 }}
                    formatter={v => [`${v.toFixed(1)}%`, t('analyticsStudent.chartScore')]} 
                  />
                  <Line type="monotone" dataKey="score" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ fontSize: 13, color: GRAY_3, textAlign: 'center', margin: 0 }}>
                {t('analyticsStudent.chartEmpty')}
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ padding: '0 24px', borderBottom: BORDER }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(tItem => (
              <button key={tItem.key} onClick={() => setTab(tItem.key)} style={{
                padding: '14px 18px', border: 'none', background: 'none', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'color .15s',
                color: tab === tItem.key ? BLUE : GRAY_3,
                borderBottom: `2px solid ${tab === tItem.key ? BLUE : 'transparent'}`,
                marginBottom: -1,
              }}>{tItem.label}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: 24 }}>
          {/* 🔥 Передаем функцию t как пропс в дочерние компоненты */}
          {tab === 'quizzes'   && <QuizHistory   history={data?.quiz_history} t={t} />}
          {tab === 'scenarios' && <ScenarioHistory history={data?.scenario_history} t={t} />}
          {tab === 'weak'      && <WeakTopics      topics={data?.weak_topics} t={t} />}
        </div>
      </Card>

      <AIRecommendations data={data} t={t} />
    </div>
  );
}