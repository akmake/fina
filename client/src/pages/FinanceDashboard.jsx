import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Loader2,
  Wallet, PiggyBank, BarChart2, Home, ChevronLeft, Zap, Target,
  ArrowUpRight, ArrowDownRight, Info, Plus, Upload,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];
const fmt = formatCurrency;

// ─── Plain-language story ──────────────────────────────────────────────────────
function buildStory(summary, netWorth, healthScore) {
  if (!summary) return [];
  const { thisMonth, prevMonth } = summary.monthlySummary ?? {};
  const income  = thisMonth?.income  ?? 0;
  const expense = thisMonth?.expense ?? 0;
  const net     = income - expense;
  const prevNet = (prevMonth?.income ?? 0) - (prevMonth?.expense ?? 0);
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;
  const nwTotal = netWorth?.totalNetWorth ?? 0;
  const grade   = healthScore?.grade ?? '';
  const lines   = [];

  if (income === 0 && expense === 0) {
    lines.push({ icon: '📭', text: 'עדיין אין עסקאות לחודש הנוכחי — ייבא נתונים כדי לראות את המצב שלך.', tone: 'neutral' });
  } else if (net >= 0) {
    const vsLast = net > prevNet + 100 ? '— יותר מהחודש שעבר 📈' : net < prevNet - 100 ? '— פחות מהחודש שעבר 📉' : '— דומה לחודש שעבר';
    const quality = savingsRate >= 20 ? 'מעולה, מעל הממוצע!' : savingsRate >= 10 ? 'סביר, אפשר לשפר.' : 'נמוך — כדאי לבדוק לאן הולך הכסף.';
    lines.push({ icon: '💰', text: `החודש הכנסת ${fmt(income)} והוצאת ${fmt(expense)}. חיסכת ${fmt(net)} (${savingsRate}%) — ${quality} ${vsLast}`, tone: 'positive' });
  } else {
    lines.push({ icon: '⚠️', text: `החודש הוצאת ${fmt(Math.abs(net))} יותר ממה שהכנסת. כדאי להבין מאיפה ולתקן בחודש הבא.`, tone: 'warning' });
  }

  if (nwTotal !== 0) {
    lines.push({
      icon: '🏦',
      text: nwTotal > 0
        ? `השווי הנקי שלך עומד על ${fmt(nwTotal)}. הנכסים גדולים מהחובות — מצב טוב.`
        : `השווי הנקי שלך הוא ${fmt(nwTotal)}. יש יותר חובות מנכסים — שים לב לזה.`,
      tone: nwTotal > 0 ? 'positive' : 'warning',
    });
  }

  const top = summary.topCategories?.[0];
  if (top) {
    lines.push({ icon: '🔍', text: `ההוצאה הגדולה ביותר החודש: ${top.category} — ${fmt(top.total)}. שווה לבדוק אם זה בגדר הצפוי.`, tone: 'neutral' });
  }

  const gradeMap = { 'A+': 'מצוין! הציון הפיננסי שלך גבוה מאוד.', A: 'טוב מאוד. אתה בדרך הנכונה.', B: 'סביר. עם כמה שיפורים קטנים תגיע לרמה גבוהה יותר.', C: 'יש מקום לשיפור — עיין בהמלצות.', D: 'המצב מצריך תשומת לב.', F: 'יש נקודות קריטיות לטפל בהן.' };
  if (grade && gradeMap[grade]) {
    lines.push({ icon: '📊', text: `${gradeMap[grade]} ציון: ${grade}${healthScore?.label ? ` — ${healthScore.label}` : ''}`, tone: ['A+','A'].includes(grade) ? 'positive' : ['D','F'].includes(grade) ? 'warning' : 'neutral' });
  }
  return lines;
}

// ─── Shared UI helpers ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'month',  label: 'החודש',  icon: Wallet    },
  { id: 'trends', label: 'מגמות',  icon: BarChart2 },
  { id: 'assets', label: 'נכסים',  icon: Home      },
  { id: 'annual', label: 'שנתי',   icon: Target    },
];

function KpiCard({ label, value, sub, positive, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4 flex flex-col gap-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      {loading
        ? <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" />
        : <p className="text-2xl font-black text-slate-900">{value}</p>}
      {sub && !loading && (
        <p className={`text-xs font-medium flex items-center gap-0.5 ${positive === true ? 'text-emerald-600' : positive === false ? 'text-red-500' : 'text-slate-400'}`}>
          {positive === true ? <ArrowUpRight className="h-3 w-3" /> : positive === false ? <ArrowDownRight className="h-3 w-3" /> : null}
          {sub}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, link, linkLabel }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">{icon}<h3 className="text-sm font-bold text-slate-700">{title}</h3></div>
      {link && <Link to={link} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 font-medium">{linkLabel}<ChevronLeft className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}

function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="text-3xl mb-1">{icon}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 max-w-xs">{desc}</p>
      {action && (
        <Link to={action} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="h-3 w-3" />{actionLabel}
        </Link>
      )}
    </div>
  );
}

function TabSpinner() {
  return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function FinanceDashboard() {
  const [core,        setCore]        = useState(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [activeTab,   setActiveTab]   = useState('month');
  const [tabData,     setTabData]     = useState({});
  const [tabLoading,  setTabLoading]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sumRes, nwRes, hsRes, apRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/net-worth').catch(() => ({ data: null })),
          api.get('/net-worth/health-score').catch(() => ({ data: null })),
          api.get('/analytics/action-plan').catch(() => ({ data: null })),
        ]);
        setCore({ summary: sumRes.data, netWorth: nwRes.data, healthScore: hsRes.data, actionPlan: apRes.data });
      } catch { /* silent */ } finally { setCoreLoading(false); }
    })();
  }, []);

  const loadTab = useCallback(async (tab) => {
    if (tabData[tab]) return;
    setTabLoading(true);
    try {
      if (tab === 'month') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [budgetRes, alertsRes, recRes, catRes] = await Promise.all([
          api.get(`/budgets?month=${now.getMonth()+1}&year=${now.getFullYear()}`).catch(() => ({ data: null })),
          api.get('/alerts').catch(() => ({ data: { alerts: [] } })),
          api.get('/analytics/recommendations').catch(() => ({ data: { recommendations: [] } })),
          api.get(`/analytics/smart-analytics?startDate=${startOfMonth.toISOString()}&endDate=${now.toISOString()}`).catch(() => ({ data: null })),
        ]);
        setTabData(p => ({
          ...p,
          month: {
            budget: budgetRes.data,
            alerts: alertsRes.data?.alerts ?? [],
            recommendations: recRes.data?.data?.recommendations ?? recRes.data?.recommendations ?? [],
            categories: catRes.data?.data?.topCategories ?? catRes.data?.topCategories ?? [],
          },
        }));
      } else if (tab === 'trends') {
        const end = new Date(), start = subMonths(end, 5);
        const res = await api.get(`/analytics/smart-analytics?startDate=${start.toISOString()}&endDate=${end.toISOString()}`).catch(() => ({ data: null }));
        // API wraps response: { status, data: { trends, topCategories, ... } }
        setTabData(p => ({ ...p, trends: res.data?.data ?? res.data }));
      } else if (tab === 'assets') {
        const res = await api.get('/net-worth/history').catch(() => ({ data: [] }));
        setTabData(p => ({ ...p, assets: Array.isArray(res.data) ? res.data : res.data?.history ?? [] }));
      } else if (tab === 'annual') {
        const [yrRes, fsRes] = await Promise.all([
          api.get('/reports/yearly-comparison').catch(() => ({ data: null })),
          api.get('/reports/financial-summary').catch(() => ({ data: null })),
        ]);
        setTabData(p => ({ ...p, annual: { yearly: yrRes.data, summary: fsRes.data } }));
      }
    } finally { setTabLoading(false); }
  }, [tabData]);

  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);

  const story   = buildStory(core?.summary, core?.netWorth, core?.healthScore);
  const monthly = core?.summary?.monthlySummary;
  const income  = monthly?.thisMonth?.income  ?? 0;
  const expense = monthly?.thisMonth?.expense ?? 0;
  const net     = income - expense;
  const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0;
  const nwTotal = core?.netWorth?.totalNetWorth ?? 0;

  // Balance chart from dashboard: [{date, balance}]
  const balanceChart = (core?.summary?.balanceChartData ?? []).map(p => ({
    name: p.date ? format(new Date(p.date), 'd/M', { locale: he }) : '',
    יתרה: p.balance ?? 0,
  }));

  return (
    <div className="min-h-screen bg-[#F2F4F8]" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Story card ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white/90">המצב שלך — בקצרה</h2>
          </div>

          {coreLoading ? (
            <div className="space-y-2">
              {[80,65,75].map((w,i) => <div key={i} className="h-4 bg-white/10 rounded animate-pulse" style={{ width: `${w}%` }} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {story.map((line, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                  line.tone === 'positive' ? 'bg-emerald-500/15 border border-emerald-500/20'
                  : line.tone === 'warning'  ? 'bg-amber-500/15 border border-amber-500/20'
                  : 'bg-white/5 border border-white/10'
                }`}>
                  <span className="text-base leading-none mt-0.5 shrink-0">{line.icon}</span>
                  <p className="text-sm text-white/90 leading-relaxed">{line.text}</p>
                </div>
              ))}
            </div>
          )}

          {!coreLoading && core?.actionPlan?.data?.actions?.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-3">3 דברים לעשות עכשיו</p>
              <div className="space-y-2">
                {core.actionPlan.data.actions.slice(0, 3).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-white/80">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">{i+1}</div>
                    <span className="flex-1">{a.title}</span>
                    {a.amount > 0 && <span className="text-amber-300 font-semibold text-xs">{fmt(a.amount)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── KPI row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="הכנסות" value={fmt(income)}
            sub={monthly?.prevMonth ? `לעומת ${fmt(monthly.prevMonth.income)}` : null}
            positive={income >= (monthly?.prevMonth?.income ?? 0)} loading={coreLoading} />
          <KpiCard label="הוצאות" value={fmt(expense)}
            sub={monthly?.prevMonth ? `לעומת ${fmt(monthly.prevMonth.expense)}` : null}
            positive={expense <= (monthly?.prevMonth?.expense ?? 0)} loading={coreLoading} />
          <KpiCard label="חיסכון נטו" value={fmt(net)}
            sub={income > 0 ? `${savingsRate}% מההכנסה` : null}
            positive={net >= 0} loading={coreLoading} />
          <KpiCard label="שווי נקי" value={fmt(nwTotal)}
            sub={core?.healthScore ? `ציון ${core.healthScore.grade}` : null}
            positive={nwTotal >= 0} loading={coreLoading} />
        </div>

        {/* ── Persistent balance chart ─────────────────────────────────── */}
        {!coreLoading && balanceChart.length > 1 && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
            <SectionTitle icon={<TrendingUp className="h-4 w-4 text-blue-500" />} title="יתרת חשבון — חודש נוכחי" />
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={balanceChart}>
                <defs>
                  <linearGradient id="gBal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={36} />
                <Tooltip formatter={v => fmt(v)} />
                <Area type="monotone" dataKey="יתרה" stroke="#3b82f6" fill="url(#gBal)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = t.id === activeTab;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${active ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {tabLoading && !tabData[activeTab]
              ? <TabSpinner />
              : (
                <>
                  {activeTab === 'month'  && <MonthTab  data={tabData.month}  core={core} />}
                  {activeTab === 'trends' && <TrendsTab data={tabData.trends} />}
                  {activeTab === 'assets' && <AssetsTab history={tabData.assets} core={core} />}
                  {activeTab === 'annual' && <AnnualTab data={tabData.annual} />}
                </>
              )
            }
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: החודש
// ─────────────────────────────────────────────────────────────────────────────
function MonthTab({ data, core }) {
  const topCats = data?.categories?.length > 0
    ? data.categories
    : (core?.summary?.topCategories ?? []);
  const alerts  = (data?.alerts ?? []).filter(a => !a.read).slice(0, 4);
  const recs    = (data?.recommendations ?? []).slice(0, 3);
  const budget  = data?.budget;

  if (!data && !core?.summary) return <TabSpinner />;

  return (
    <div className="space-y-7">

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <SectionTitle icon={<AlertCircle className="h-4 w-4 text-amber-500" />} title="התראות פעילות" link="/alerts" linkLabel="כל ההתראות" />
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{a.message ?? a.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div>
          <SectionTitle icon={<Zap className="h-4 w-4 text-blue-500" />} title="המלצות לחודש זה" link="/smart-analytics" linkLabel="ניתוח מלא" />
          <div className="space-y-2">
            {recs.map((r, i) => (
              <div key={i} className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${r.priority === 'high' ? 'bg-red-500' : r.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                <p className="text-sm text-blue-900">{r.suggestion ?? r.text ?? r.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top categories — horizontal bar chart */}
      {topCats.length > 0 ? (
        <div>
          <SectionTitle icon={<BarChart2 className="h-4 w-4 text-violet-500" />} title="הוצאות לפי קטגוריה" link="/categories" linkLabel="ניתוח מעמיק" />
          <div className="space-y-3">
            {(() => {
              const max = Math.max(...topCats.slice(0, 6).map(c => c.total));
              return topCats.slice(0, 6).map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{c.category}</span>
                    <span className="font-bold text-slate-900">{fmt(c.total)}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round((c.total / max) * 100)}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      ) : (
        <EmptyState icon="📊" title="אין עסקאות החודש" desc="ייבא עסקאות כדי לראות ניתוח לפי קטגוריות" action="/import/auto" actionLabel="ייבוא אוטומטי" />
      )}

      {/* Budget vs actual */}
      {budget?.categories?.length > 0 && (
        <div>
          <SectionTitle icon={<Wallet className="h-4 w-4 text-emerald-500" />} title="תקציב מול פועל" link="/budget" linkLabel="לתקציב המלא" />
          <div className="space-y-3">
            {budget.categories.slice(0, 6).map((cat, i) => {
              const pct = cat.limit > 0 ? Math.round((cat.actual / cat.limit) * 100) : 0;
              const over = pct > 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs text-slate-600 mb-1 font-medium">
                    <span>{cat.category}</span>
                    <span className={over ? 'text-red-500 font-bold' : ''}>{fmt(cat.actual)} / {fmt(cat.limit)} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: מגמות
// ─────────────────────────────────────────────────────────────────────────────
function TrendsTab({ data }) {
  if (!data) return <TabSpinner />;

  const trends    = data?.trends ?? [];
  const catData   = data?.topCategories ?? [];
  const anomalies = data?.anomalies ?? [];
  const efficiency = data?.efficiency ?? null;
  const summary   = data?.summary;

  // trends: [{date, income, expense, net}] → chart format
  const trendChart = trends.map(t => ({
    name:    t.month ?? (t.date ? format(new Date(t.date), 'MMM yy', { locale: he }) : ''),
    הכנסות: t.income  ?? 0,
    הוצאות: t.expense ?? 0,
  })).filter(t => t.name);

  const pieData = catData.slice(0, 7).map(c => ({ name: c.category, value: c.total ?? c.amount ?? 0 })).filter(d => d.value > 0);

  const hasData = trendChart.length > 0 || pieData.length > 0;

  if (!hasData) {
    return (
      <EmptyState icon="📈" title="אין מספיק נתונים לניתוח מגמות"
        desc="ייבא נתונים מכמה חודשים כדי לראות מגמות"
        action="/smart-analytics" actionLabel="מעבר לניתוח חכם" />
    );
  }

  return (
    <div className="space-y-7">

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'סה"כ הכנסות', value: fmt(summary.totalIncome ?? 0) },
            { label: 'סה"כ הוצאות', value: fmt(summary.totalExpense ?? 0) },
            { label: 'תזרים נקי',   value: fmt(summary.netFlow ?? 0), colored: true, positive: (summary.netFlow ?? 0) >= 0 },
            { label: 'יעילות',      value: efficiency != null ? `${Math.round(efficiency)}%` : '—' },
          ].map((k, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl p-3 text-center">
              <p className="text-[11px] text-slate-400 mb-1">{k.label}</p>
              <p className={`text-base font-black ${k.colored ? (k.positive ? 'text-emerald-600' : 'text-red-500') : 'text-slate-900'}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 6-month trend chart */}
      {trendChart.length > 0 && (
        <div>
          <SectionTitle icon={<TrendingUp className="h-4 w-4 text-blue-500" />} title="הכנסות מול הוצאות — לאורך זמן" link="/smart-analytics" linkLabel="ניתוח מלא" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendChart}>
              <defs>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={36} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
              <Area type="monotone" dataKey="הכנסות" stroke="#10b981" fill="url(#gI)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="הוצאות" stroke="#ef4444" fill="url(#gE)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category pie + legend */}
      {pieData.length > 0 && (
        <div>
          <SectionTitle icon={<BarChart2 className="h-4 w-4 text-violet-500" />} title="פילוח הוצאות לפי קטגוריה" link="/categories" linkLabel="ניתוח קטגוריות" />
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-2">
              {pieData.map((d, i) => {
                const total = pieData.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 text-sm text-slate-600 truncate">{d.name}</span>
                    <span className="text-xs text-slate-400">{pct}%</span>
                    <span className="font-semibold text-sm text-slate-800 min-w-[64px] text-left">{fmt(d.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div>
          <SectionTitle icon={<AlertCircle className="h-4 w-4 text-amber-500" />} title={`חריגות שזוהו (${anomalies.length})`} />
          <div className="space-y-2">
            {anomalies.slice(0, 4).map((a, i) => (
              <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-sm text-amber-800">
                {a.description ?? a.text ?? a.category ?? ''}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: נכסים
// ─────────────────────────────────────────────────────────────────────────────
function AssetsTab({ history, core }) {
  const nw  = core?.netWorth;
  const hs  = core?.healthScore;

  const histData = (history ?? []).map(h => ({
    name: h.date ? format(new Date(h.date), 'MMM yy', { locale: he }) : '',
    שווי: h.netWorth ?? h.value ?? 0,
  })).filter(h => h.name);

  const assetRows = [
    { label: 'פיקדונות',     value: nw?.deposits       ?? 0 },
    { label: 'מניות',        value: nw?.stocks          ?? 0 },
    { label: 'קרנות',        value: nw?.funds           ?? 0 },
    { label: 'פנסיה',        value: nw?.pension         ?? 0 },
    { label: 'נדל"ן',        value: nw?.realEstate      ?? 0 },
    { label: 'חיסכון ילדים', value: nw?.childSavings    ?? 0 },
    { label: 'מט"ח',         value: nw?.foreignCurrency ?? 0 },
  ].filter(r => r.value > 0);

  const liabilityRows = [
    { label: 'הלוואות',  value: nw?.loans      ?? 0 },
    { label: 'משכנתא',   value: nw?.mortgage   ?? 0 },
    { label: 'חובות',    value: nw?.debts      ?? 0 },
  ].filter(r => r.value > 0);

  const pieData = assetRows.map(r => ({ name: r.label, value: r.value }));

  const hasAny = (nw?.totalAssets ?? 0) + (nw?.totalLiabilities ?? 0) > 0;

  return (
    <div className="space-y-7">

      {/* 3-metric hero */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'שווי נקי',      value: nw?.totalNetWorth    ?? 0, cls: 'text-slate-900'   },
          { label: 'נכסים',         value: nw?.totalAssets      ?? 0, cls: 'text-emerald-600' },
          { label: 'התחייבויות',    value: nw?.totalLiabilities ?? 0, cls: 'text-red-500'     },
        ].map((r, i) => (
          <div key={i} className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[11px] text-slate-400 mb-1.5">{r.label}</p>
            <p className={`text-lg font-black ${r.cls}`}>{fmt(r.value)}</p>
          </div>
        ))}
      </div>

      {/* Asset pie chart */}
      {pieData.length > 0 ? (
        <div>
          <SectionTitle icon={<PiggyBank className="h-4 w-4 text-emerald-500" />} title="פירוט נכסים" link="/net-worth" linkLabel="תמונה מלאה" />
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-2">
              {assetRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b border-slate-50 last:border-0">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 text-sm text-slate-600">{r.label}</span>
                  <span className="text-sm font-bold text-slate-900">{fmt(r.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState icon="🏦" title="אין נכסים מוגדרים" desc="הוסף פיקדונות, מניות, פנסיה ועוד כדי לעקוב אחר השווי הנקי שלך"
          action="/deposits" actionLabel="הוסף פיקדון" />
      )}

      {/* Liabilities */}
      {liabilityRows.length > 0 && (
        <div>
          <SectionTitle icon={<TrendingDown className="h-4 w-4 text-red-500" />} title="התחייבויות" />
          <div className="space-y-1">
            {liabilityRows.map((r, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-slate-50 last:border-0 text-sm">
                <span className="text-slate-600">{r.label}</span>
                <span className="font-bold text-red-500">{fmt(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Net worth history */}
      {histData.length > 1 && (
        <div>
          <SectionTitle icon={<TrendingUp className="h-4 w-4 text-blue-500" />} title="שווי נקי — היסטוריה" />
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={histData}>
              <defs>
                <linearGradient id="gNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={36} />
              <Tooltip formatter={v => fmt(v)} />
              <Area type="monotone" dataKey="שווי" stroke="#3b82f6" fill="url(#gNW)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Health score */}
      {hs && (
        <div>
          <SectionTitle icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} title="ציון בריאות פיננסית" link="/net-worth" linkLabel="פרטים נוספים" />
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-5">
            <div className="text-6xl font-black text-slate-900 leading-none">{hs.grade}</div>
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-base">{hs.label}</p>
              <p className="text-sm text-slate-400 mt-0.5">ציון {hs.score}/100</p>
              <div className="mt-2 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-blue-500 to-indigo-500" style={{ width: `${hs.score}%` }} />
              </div>
            </div>
          </div>
          {hs.tips?.slice(0, 3).map((t, i) => (
            <div key={i} className="flex items-start gap-2 mt-2 text-sm text-slate-600">
              <span className="shrink-0">{t.icon ?? '•'}</span><span>{t.tip ?? t}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: שנתי
// ─────────────────────────────────────────────────────────────────────────────
function AnnualTab({ data }) {
  if (!data) return <TabSpinner />;
  const yr  = data?.yearly;
  const fs  = data?.summary;
  const monthlyData = (yr?.monthlyData ?? []).map(m => ({
    ...m,
    month: m.month ?? m.label ?? '',
    income:  m.income  ?? m.currentIncome  ?? 0,
    expense: m.expense ?? m.currentExpense ?? 0,
  }));

  if (!yr && !fs) {
    return (
      <EmptyState icon="📅" title="אין נתונים שנתיים" desc="נדרש לפחות שנה של עסקאות לניתוח שנתי" action="/reports" actionLabel="לדוחות" />
    );
  }

  return (
    <div className="space-y-7">

      {/* YoY KPI grid */}
      {yr && (
        <div>
          <SectionTitle icon={<BarChart2 className="h-4 w-4 text-blue-500" />} title={`השוואה שנתית — ${yr.currentYear ?? ''} מול ${yr.previousYear ?? ''}`} link="/reports" linkLabel="דוח מלא" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'הכנסות',      cur: yr.currentYear?.income,      prev: yr.previousYear?.income,      positive: true  },
              { label: 'הוצאות',      cur: yr.currentYear?.expense,     prev: yr.previousYear?.expense,     positive: false },
              { label: 'חיסכון',      cur: yr.currentYear?.savings,     prev: yr.previousYear?.savings,     positive: true  },
              { label: 'שיעור חיסכון', cur: yr.currentYear?.savingsRate, prev: yr.previousYear?.savingsRate, positive: true, pct: true },
            ].filter(r => r.cur != null).map((r, i) => {
              const up = r.positive ? r.cur >= (r.prev ?? 0) : r.cur <= (r.prev ?? 0);
              return (
                <div key={i} className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 mb-1">{r.label}</p>
                  <p className="text-xl font-black text-slate-900">{r.pct ? `${r.cur?.toFixed(1)}%` : fmt(r.cur)}</p>
                  {r.prev != null && (
                    <p className={`text-xs flex items-center gap-0.5 mt-1 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                      {up ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
                      {r.pct ? `${r.prev?.toFixed(1)}%` : fmt(r.prev)} שנה קודמת
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly bar chart */}
      {monthlyData.length > 0 && (
        <div>
          <SectionTitle icon={<BarChart2 className="h-4 w-4 text-slate-400" />} title="הכנסות vs הוצאות לפי חודש" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={36} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
              <Bar dataKey="income"  name="הכנסות" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="expense" name="הוצאות" fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Financial summary breakdown */}
      {fs && (
        <div>
          <SectionTitle icon={<Home className="h-4 w-4 text-slate-400" />} title="סיכום כולל — נכסים והתחייבויות" link="/net-worth" linkLabel="שווי נקי מלא" />
          <div className="space-y-1">
            {Object.entries({
              'חשבונות':      fs.accounts?.total,
              'פיקדונות':     fs.deposits?.total,
              'מניות':        fs.stocks?.total,
              'פנסיה':        fs.pension?.total,
              'הלוואות':      fs.loans?.total       != null ? -(fs.loans.total)       : null,
              'משכנתאות':     fs.mortgages?.total   != null ? -(fs.mortgages.total)   : null,
              'נדל"ן':        fs.realEstate?.totalValue,
              'חיסכון ילדים': fs.childSavings?.total,
              'יעדים':        fs.goals?.totalSaved,
            }).filter(([, v]) => v != null && v !== 0).map(([label, val], i) => (
              <div key={i} className="flex justify-between py-2.5 border-b border-slate-50 last:border-0 text-sm">
                <span className="text-slate-600">{label}</span>
                <span className={`font-semibold ${val >= 0 ? 'text-slate-900' : 'text-red-500'}`}>{fmt(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
