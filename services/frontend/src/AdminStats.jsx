import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Импортируем хук переводов
import api from './api';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
// ✅ Импортируем строгие иконки
import { 
  Users, GraduationCap, BookOpen, UserPlus, Library, CheckCircle, 
  FileText, Zap, UserCheck, BarChart2, Target, Award 
} from 'lucide-react';

const BLUE   = '#2563EB';
const GREEN  = '#059669';
const AMBER  = '#D97706';
const RED    = '#DC2626';
const GRAY_1 = '#0F172A';
const GRAY_2 = '#475569';
const GRAY_3 = '#94A3B8';
const GRAY_5 = '#E2E8F0';
const BORDER = '1px solid #E2E8F0';
const SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)';

// ─── BASE ────────────────────────────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: BORDER, boxShadow: SHADOW, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: GRAY_1, margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontSize: 12, color: GRAY_3, margin: '3px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = BLUE, icon }) {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: accent + '14', color: accent, // ✅ Цвет иконки соответствует акценту
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: GRAY_1, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: GRAY_2, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: GRAY_3, marginTop: 2 }}>{sub}</div>}
      <div style={{ marginTop: 14, height: 2, background: GRAY_5, borderRadius: 99 }}>
        <div style={{ width: 28, height: 2, background: accent, borderRadius: 99 }} />
      </div>
    </Card>
  );
}

// ─── MINI PROGRESS ───────────────────────────────────────────────────────────

function MiniBar({ label, value, max, color = BLUE }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: GRAY_2 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: GRAY_1 }}>{value}</span>
      </div>
      <div style={{ height: 5, background: GRAY_5, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function AdminStats() {
  const { t, i18n } = useTranslation(); // ✅ Инициализируем переводы
  
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    api.get('users/stats/')
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(e.response?.data?.detail || t('adminStats.error')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
      <div style={{ width: 28, height: 28, border: `2px solid ${GRAY_5}`, borderTopColor: BLUE, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <p style={{ color: RED, fontSize: 14, margin: 0 }}>{error}</p>
    </div>
  );

  const { users, courses, activity, top_courses, registrations_by_day } = data;

  // Форматируем даты для графика в зависимости от текущего языка (ru, kk, en)
  const localeMap = { 'ru': 'ru-RU', 'kk': 'kk-KZ', 'en': 'en-US' };
  const currentLocale = localeMap[i18n.language] || 'ru-RU';

  const regChart = registrations_by_day.map(d => ({
    day: new Date(d.day).toLocaleDateString(currentLocale, { day: 'numeric', month: 'short' }),
    count: d.count,
  }));

  const topChart = top_courses.map(c => ({
    name: c.title.length > 20 ? c.title.slice(0, 20) + '…' : c.title,
    enrollments: c.enrollments_count,
  }));

  const CHART_COLORS = [BLUE, GREEN, AMBER, '#6366F1', '#0891B2'];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4px 0 56px', fontFamily: 'inherit' }}>

      {/* Заголовок */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GRAY_3, margin: '0 0 6px' }}>
          {t('adminStats.subtitle')}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: GRAY_1, margin: 0 }}>
          {t('adminStats.title')}
        </h1>
      </div>

      {/* ── Строка 1: Пользователи ── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GRAY_3, margin: '0 0 12px' }}>
        {t('adminStats.sections.users')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={<Users size={20} />} label={t('adminStats.users.total')} value={users.total}         accent={BLUE}  sub={t('adminStats.users.subNewWeek', { count: users.new_this_week })} />
        <StatCard icon={<GraduationCap size={20} />} label={t('adminStats.users.students')}      value={users.students}      accent={BLUE} />
        <StatCard icon={<Library size={20} />} label={t('adminStats.users.teachers')}      value={users.teachers}      accent={GREEN} />
        <StatCard icon={<UserPlus size={20} />} label={t('adminStats.users.new')}      value={users.new_this_month} accent={AMBER} />
      </div>

      {/* ── Строка 2: Курсы ── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GRAY_3, margin: '0 0 12px' }}>
        {t('adminStats.sections.content')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={<BookOpen size={20} />} label={t('adminStats.courses.total')}     value={courses.total}     accent={BLUE} />
        <StatCard icon={<CheckCircle size={20} />} label={t('adminStats.courses.published')}     value={courses.published}  accent={GREEN} sub={t('adminStats.courses.pendingSub', { count: courses.pending })} />
        <StatCard icon={<FileText size={20} />} label={t('adminStats.courses.lessons')}     value={courses.lessons}    accent='#6366F1' />
        <StatCard icon={<Zap size={20} />} label={t('adminStats.courses.steps')}      value={courses.steps}      accent={AMBER} />
      </div>

      {/* ── Строка 3: Активность ── */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: GRAY_3, margin: '0 0 12px' }}>
        {t('adminStats.sections.activity')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard icon={<UserCheck size={20} />} label={t('adminStats.activity.enrollments')} value={activity.total_enrollments} accent={BLUE}  sub={t('adminStats.activity.enrollmentsSub', { count: activity.enrollments_30d })} />
        <StatCard icon={<BarChart2 size={20} />} label={t('adminStats.activity.quizzes')}        value={activity.total_quiz_results} accent='#6366F1' />
        <StatCard icon={<Target size={20} />} label={t('adminStats.activity.avgScore')}          value={`${activity.avg_quiz_score}%`} accent={activity.avg_quiz_score >= 70 ? GREEN : AMBER} />
        <StatCard icon={<Award size={20} />} label={t('adminStats.activity.passRate')}          value={`${activity.pass_rate}%`}    accent={activity.pass_rate >= 70 ? GREEN : RED} sub={t('adminStats.activity.passRateSub')} />
      </div>

      {/* ── Графики ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Регистрации по дням */}
        <Card style={{ padding: 24 }}>
          <SectionTitle sub={t('adminStats.charts.regsSub')}>
            {t('adminStats.charts.regsTitle')}
          </SectionTitle>
          {regChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={regChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRAY_5} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: GRAY_3 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: GRAY_3 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: BORDER, fontSize: 12, boxShadow: SHADOW }}
                  formatter={v => [v, t('adminStats.charts.regsTooltip')]}
                />
                <Line type="monotone" dataKey="count" stroke={BLUE} strokeWidth={2.5}
                  dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: GRAY_3, margin: 0 }}>{t('adminStats.charts.regsEmpty')}</p>
            </div>
          )}
        </Card>

        {/* Топ курсов */}
        <Card style={{ padding: 24 }}>
          <SectionTitle sub={t('adminStats.charts.topSub')}>
            {t('adminStats.charts.topTitle')}
          </SectionTitle>
          {topChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topChart} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRAY_5} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: GRAY_3 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: GRAY_2 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: BORDER, fontSize: 12, boxShadow: SHADOW }}
                  formatter={v => [v, t('adminStats.charts.topTooltip')]}
                />
                <Bar dataKey="enrollments" radius={[0, 4, 4, 0]}>
                  {topChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: GRAY_3, margin: 0 }}>{t('adminStats.charts.topEmpty')}</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Распределение курсов ── */}
      <Card style={{ padding: 24 }}>
        <SectionTitle sub={t('adminStats.dist.sub')}>
          {t('adminStats.dist.title')}
        </SectionTitle>
        <div style={{ maxWidth: 480 }}>
          <MiniBar label={t('adminStats.dist.published')}   value={courses.published} max={courses.total} color={GREEN} />
          <MiniBar label={t('adminStats.dist.draft')}        value={courses.draft}     max={courses.total} color={GRAY_3} />
          <MiniBar label={t('adminStats.dist.pending')}     value={courses.pending}   max={courses.total} color={AMBER} />
          <MiniBar
            label={t('adminStats.dist.rejected')}
            value={courses.total - courses.published - courses.draft - courses.pending}
            max={courses.total}
            color={RED}
          />
        </div>
      </Card>

    </div>
  );
}