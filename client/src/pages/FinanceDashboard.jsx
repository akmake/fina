import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import UpdatesBrief from '@/components/dashboard/UpdatesBrief';
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  Wallet, BarChart2, Home, ChevronLeft, Target, Bell,
  ArrowUpRight, ArrowDownRight, Upload, PiggyBank,
  PieChart as PieChartIcon, Sparkles, ArrowLeft
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Panel, SectionTitle, EmptyState, useChartTheme, CHART_COLORS } from '@/components/dashboard/kit';

const COLORS = CHART_COLORS;
const fmt = formatCurrency;

// severity → card styling for the dashboard alert cards (mirrors AlertsPage)
const ALERT_SEVERITY = {
  info:    { dot: 'bg-blue-500',    box: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40',       text: 'text-blue-700 dark:text-blue-200' },
  warning: { dot: 'bg-amber-500',   box: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40',   text: 'text-amber-800 dark:text-amber-200' },
  danger:  { dot: 'bg-red-500',     box: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40',           text: 'text-red-700 dark:text-red-200' },
  success: { dot: 'bg-emerald-500', box: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-200' },
};

// ─── UI Helpers ─────────────────────────────────────────────────────────────
const TONES = {
  mint:   'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  coral:  'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300',
  violet: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  sun:    'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
};

function StatCard({ label, value, sub, positive, icon: Icon, tone = 'violet' }) {
  return (
    <Panel className="flex min-h-[8.5rem] flex-col justify-between p-5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${TONES[tone]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-[1.6rem] font-bold leading-none tracking-[-0.03em] text-slate-900 dark:text-white">{value}</p>
        {sub && (
          <p className={`chip mt-2.5 ${positive === true ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : positive === false ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}>
            {positive === true && <ArrowUpRight className="h-3 w-3" />}
            {positive === false && <ArrowDownRight className="h-3 w-3" />}
            {sub}
          </p>
        )}
      </div>
    </Panel>
  );
}

/** Hero net-worth card — the one gradient surface on the dashboard. */
function HeroCard({ value, sub, history }) {
  const trend = (history || []).slice(-8);
  return (
    <div className="brand-gradient relative flex min-h-[17.5rem] flex-col justify-between overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-blue-700/30 sm:col-span-2 xl:row-span-2">
      <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 right-4 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <span className="text-sm font-semibold text-white/80">שווי נקי כולל</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><Home className="h-[18px] w-[18px]" /></span>
      </div>
      <div className="relative">
        <p className="text-[2.6rem] font-extrabold leading-none tracking-[-0.04em] sm:text-[3rem]">{value}</p>
        {sub && <p className="chip mt-3 bg-white/15 text-white backdrop-blur">{sub}</p>}
      </div>
      {trend.length > 1 && (
        <div className="relative -mx-2 -mb-2 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs><linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.35} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey="שווי" stroke="#fff" strokeWidth={2.5} fill="url(#heroFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Block({ children, className = '', colSpan = 1, rowSpan = 1 }) {
  const colClasses = {
    1: '',
    2: 'md:col-span-2',
    3: 'md:col-span-2 xl:col-span-3',
    4: 'md:col-span-2 xl:col-span-4',
  };
  const rowClasses = {
    1: 'lg:row-span-1',
    2: 'lg:row-span-2',
  };
  return (
    <Panel className={`p-4 flex flex-col ${colClasses[colSpan]} ${rowClasses[rowSpan]} ${className}`}>
      {children}
    </Panel>
  );
}

// ─── Loading Skeleton (במקום ספינר מסך-מלא) ─────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="max-w-[1600px] mx-auto space-y-6 animate-pulse">
        <div className="h-9 w-56 bg-slate-200 dark:bg-white/10 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-32 bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="lg:col-span-2 h-[380px] bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-lg" />
          <div className="h-[380px] bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-lg" />
          <div className="h-[380px] bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function FinanceDashboard() {
  const navigate = useNavigate();
  const chartTheme = useChartTheme();
  const queryClient = useQueryClient();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // Loads all dashboard widgets. Re-run (without the skeleton) when a background
  // bank sync finishes, so new numbers appear without a manual refresh.
  const load = useCallback(() => {
    (async () => {
      try {
        const now = new Date();
        const curStart = startOfMonth(now);
        const prevDate = subMonths(now, 1);
        const prevStart = startOfMonth(prevDate);
        const prevEnd = endOfMonth(prevDate);
        const trendStart = subMonths(now, 5);

        // Fetch everything independently so one failure doesn't break the dashboard
        const endpoints = [
          api.get('/dashboard/summary'),
          api.get('/net-worth'),
          api.get('/net-worth/health-score'),
          api.get('/net-worth/history'),
          api.get('/mortgages'),
          api.get('/goals'),
          api.get('/alerts'),
          api.get(`/budgets?month=${now.getMonth()+1}&year=${now.getFullYear()}`),
          api.get('/analytics/recommendations'),
          api.get(`/analytics/smart-analytics?startDate=${curStart.toISOString()}&endDate=${now.toISOString()}`),
          api.get(`/analytics/smart-analytics?startDate=${prevStart.toISOString()}&endDate=${prevEnd.toISOString()}`),
          api.get(`/analytics/smart-analytics?startDate=${trendStart.toISOString()}&endDate=${now.toISOString()}`),
          api.get('/reports/yearly-comparison'),
          api.get('/reports/financial-summary'),
          api.get('/reports/trends?months=6'),
        ];

        const results = await Promise.allSettled(endpoints);
        const getRes = (index) => results[index].status === 'fulfilled' ? results[index].value.data : null;

        const sumData = getRes(0);
        const curAnData = getRes(9);
        const prvAnData = getRes(10);
        const recData = getRes(8);
        const alertsData = getRes(6);
        const trendData = getRes(11);
        const catTrendsData = getRes(14);

        setData({
          summary: sumData,
          netWorth: getRes(1),
          healthScore: getRes(2),
          nwHistory: Array.isArray(getRes(3)) ? getRes(3) : getRes(3)?.history || [],
          mortgage: getRes(4),
          goals: getRes(5),
          alerts: alertsData?.alerts ?? [],
          budget: getRes(7),
          recommendations: recData?.data?.recommendations ?? recData?.recommendations ?? [],
          curCategories: curAnData?.data?.topCategories ?? curAnData?.topCategories ?? sumData?.topCategories ?? [],
          prevCategories: prvAnData?.data?.topCategories ?? prvAnData?.topCategories ?? [],
          trends: trendData?.data?.trends ?? trendData?.trends ?? [],
          yearly: getRes(12),
          finSummary: getRes(13),
          catTrends: catTrendsData?.trends ?? [],
          catTrendCategories: [...new Set((catTrendsData?.trends ?? []).flatMap(m => Object.keys(m.categories || {})))],
        });
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSynced = useCallback(() => {
    load();
    queryClient.invalidateQueries({ queryKey: ['dashboard-updates'] });
  }, [load, queryClient]);

  if (loading) return <DashboardSkeleton />;

  // ─── Data Extraction ───
  const {
    summary, netWorth, nwHistory, healthScore, budget, alerts,
    recommendations, curCategories, prevCategories, trends, yearly, finSummary,
    catTrends, catTrendCategories,
  } = data;

  const monthly = summary?.monthlySummary;
  const income = monthly?.thisMonth?.income ?? 0;
  const expense = monthly?.thisMonth?.expense ?? 0;
  const netFlow = income - expense;
  const savingsRate = income > 0 ? Math.round((netFlow / income) * 100) : null;
  // The alerts endpoint already excludes dismissed/expired alerts (newest first).
  const activeAlerts = (alerts || []).slice(0, 5);

  // Formatting for Category Comparison
  const catMap = {};
  (curCategories || []).forEach(c => { catMap[c.category] = { current: c.total, previous: 0 }; });
  (prevCategories || []).forEach(c => { if(catMap[c.category]) catMap[c.category].previous = c.total; else catMap[c.category] = { current: 0, previous: c.total }; });
  const categoryRows = Object.entries(catMap)
    .map(([cat, vals]) => ({ cat, ...vals, delta: vals.previous > 0 ? Math.round(((vals.current - vals.previous) / vals.previous) * 100) : null }))
    .sort((a, b) => b.current - a.current)
    .slice(0, 7);

  // Formatting for Trend Chart
  const trendChart = (trends || []).map(t => ({
    name: t.month ?? (t.date ? format(new Date(t.date), 'MMM yy', { locale: he }) : ''),
    הכנסות: t.income ?? 0,
    הוצאות: t.expense ?? 0,
  })).filter(t => t.name);

  // Net worth — API contract: { netWorth, assets: { total, ... }, assetBreakdown: [{label, value}] }
  // (AUDIT P1-10: the dashboard used to read totalNetWorth/totalAssets, which don't exist → ₪0)
  const netWorthTotal = netWorth?.netWorth ?? 0;
  const totalAssets = netWorth?.assets?.total ?? 0;
  const assetRows = (netWorth?.assetBreakdown ?? [])
    .map(r => ({ label: r.label, value: r.value }))
    .filter(r => r.value > 0);

  // Budget — API: { budget: { items: [{ category, limit, spent }] } } (AUDIT UX-3)
  const budgetItems = (budget?.budget?.items ?? []).filter(i => i.limit > 0);

  // Formatting for Annual Bar Chart
  const MONTH_NAMES = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
  const curYear = new Date().getFullYear();
  const yearlyMonthly = yearly?.years?.[curYear]?.monthly ?? {};
  const monthlyData = Object.entries(yearlyMonthly)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([m, d]) => ({
      month: MONTH_NAMES[Number(m) - 1],
      הכנסות: d.income ?? 0,
      הוצאות: d.expense ?? 0,
    }))
    .filter(m => m.הכנסות > 0 || m.הוצאות > 0);

  // Formatting Net Worth History
  // History API: [{ label: 'אוק 2026', netWorth }]
  const histData = (nwHistory || []).map(h => ({
    name: h.label ?? (h.date ? format(new Date(h.date), 'MMM yy', { locale: he }) : ''),
    שווי: h.netWorth ?? h.value ?? 0,
  })).filter(h => h.name);

  // ─── מצב ריק: משתמש חדש ללא נתונים בכלל → onboarding במקום גרפים ריקים ───
  const isEmpty =
    netWorthTotal === 0 &&
    income === 0 && expense === 0 &&
    assetRows.length === 0 &&
    (summary?.recentTransactions?.length ?? 0) === 0;

  if (isEmpty) {
    return (
      <div className="page-shell font-sans" dir="rtl">
        <div className="max-w-3xl space-y-8 pt-4">
          <UpdatesBrief onSynced={onSynced} />
          <Panel className="p-8">
            <EmptyState
              icon={Upload}
              title="עדיין אין נתונים במערכת"
              description="חבר בנק או כרטיס אשראי פעם אחת — מאותו רגע הסנכרון רץ כל יום לבד ואתה רק נכנס ורואה מה חדש. אפשר גם לייבא קובץ אקסל."
              actionLabel="חיבור בנק או כרטיס"
              actionTo="/connections"
            />
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell text-slate-800 dark:text-slate-200 font-sans" dir="rtl">
      <div className="space-y-7">

        {/* ─── Morning brief: what's new, live sync state, alerts ─── */}
        <UpdatesBrief onSynced={onSynced} />

        {/* ─── Row 1: hero net worth + KPIs ─── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <HeroCard
            value={fmt(netWorthTotal)}
            sub={healthScore ? `דירוג בריאות פיננסית: ${healthScore.grade}` : null}
            history={histData}
          />
          <StatCard
            label="הכנסות החודש" value={fmt(income)} tone="mint"
            sub={monthly?.prevMonth ? `חודש קודם: ${fmt(monthly.prevMonth.income)}` : null}
            positive={income >= (monthly?.prevMonth?.income ?? 0)} icon={TrendingUp}
          />
          <StatCard
            label="הוצאות החודש" value={fmt(expense)} tone="coral"
            sub={monthly?.prevMonth ? `חודש קודם: ${fmt(monthly.prevMonth.expense)}` : null}
            positive={expense <= (monthly?.prevMonth?.expense ?? 0)} icon={TrendingDown}
          />
          <StatCard
            label="חיסכון נטו" value={fmt(netFlow)} tone="violet"
            sub={null} positive={netFlow >= 0} icon={Wallet}
          />
          <StatCard
            label="שיעור חיסכון" value={savingsRate != null ? `${savingsRate}%` : '—'} tone="sun"
            sub={savingsRate != null ? (savingsRate >= 20 ? 'מעל היעד המומלץ' : 'מתחת ליעד של 20%') : null}
            positive={savingsRate != null ? savingsRate >= 20 : null} icon={PiggyBank}
          />
        </div>

        {/* ─── Row 2: Analytics & Budget (Current Focus) ─── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          
          {/* Main Chart: Income vs Expenses Trend (Spans 2 cols) */}
          <Block colSpan={2} className="min-h-[350px]">
            <SectionTitle icon={<BarChart2 className="h-4 w-4" />} title="מגמות תזרים מזומנים (6 חודשים)" link="/reports" linkLabel="דו״ח מלא" />
            <div className="flex-1 w-full h-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChart} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#14b88a" stopOpacity={0.2}/><stop offset="95%" stopColor="#14b88a" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.2}/><stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTheme.axis }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: chartTheme.axis }} width={45} />
                  <Tooltip contentStyle={chartTheme.tooltip} formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="הכנסות" stroke="#14b88a" fill="url(#colorInc)" strokeWidth={2} />
                  <Area type="monotone" dataKey="הוצאות" stroke="#ff6b6b" fill="url(#colorExp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Block>

          {/* Top Categories Comparison (Spans 1 col) */}
          <Block colSpan={1}>
            <SectionTitle icon={<PieChartIcon className="h-4 w-4" />} title="הוצאות מרכזיות החודש" link="/categories" linkLabel="פירוט" />
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {categoryRows.length > 0 ? categoryRows.map((r, i) => {
                const isUp = r.delta !== null && r.delta > 0;
                return (
                  <button key={i} onClick={() => navigate(`/portfolio?category=${encodeURIComponent(r.cat)}`)} className="w-full flex items-center justify-between group text-right hover:bg-slate-50 dark:hover:bg-white/5 p-1.5 -mx-1.5 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors">{r.cat}</p>
                        <p className="text-xs text-slate-500">קודם: {fmt(r.previous)}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(r.current)}</p>
                      <p className={`text-xs font-semibold ${isUp ? 'text-red-500' : 'text-emerald-600'}`}>
                        {r.delta !== null ? `${isUp ? '+' : ''}${r.delta}%` : 'חדש'}
                      </p>
                    </div>
                  </button>
                );
              }) : <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">אין נתוני קטגוריות החודש</p>}
            </div>
          </Block>

          {/* Budget (alerts live in the morning brief above) */}
          <Block colSpan={1} className="flex flex-col gap-6">
            <div className="flex-1">
              <SectionTitle icon={<Wallet className="h-4 w-4" />} title="ניצול תקציב" link="/budget" linkLabel="נהל" />
              <div className="space-y-4">
                {budgetItems.slice(0, 4).map((item, i) => {
                  const spent = item.spent ?? 0;
                  const pct = Math.round((spent / item.limit) * 100);
                  const over = pct > 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{item.category}</span>
                        <span className={over ? 'text-red-500 font-semibold' : 'text-slate-500'}>{fmt(spent)} / {fmt(item.limit)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {budgetItems.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">לא הוגדר תקציב לחודש הזה</p>
                )}
              </div>
            </div>
          </Block>

        </div>

        {/* ─── Row 3: Wealth & Assets ─── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 md:gap-6">
          
          {/* Net Worth Growth Chart (Spans 2 cols) */}
          <Block colSpan={2} className="min-h-[350px]">
            <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="צמיחת שווי נקי (Net Worth)" link="/net-worth" linkLabel="מאזן מלא" />
            <div className="flex-1 w-full h-full min-h-[200px]">
              {histData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={histData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="nwColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#5f3df0" stopOpacity={0.18}/><stop offset="95%" stopColor="#5f3df0" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTheme.axis }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: chartTheme.axis }} width={50} />
                    <Tooltip contentStyle={chartTheme.tooltip} formatter={v => fmt(v)} />
                    <Area type="monotone" dataKey="שווי" stroke="#5f3df0" fill="url(#nwColor)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">נדרש תיעוד של יותר מחודש להצגת גרף צמיחה</div>
              )}
            </div>
          </Block>

          {/* Asset Allocation Pie (Spans 1 col) */}
          <Block colSpan={1} className="flex flex-col">
            <SectionTitle icon={<PiggyBank className="h-4 w-4" />} title="הרכב נכסים" />
            {assetRows.length > 0 ? (
              <div className="flex-1 flex flex-col justify-center">
                <div className="h-[180px] w-full relative mb-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={assetRows} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                        {assetRows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={chartTheme.tooltip} formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-500 font-bold">סך נכסים</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{fmt(totalAssets)}</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {assetRows.map((r, i) => (
                    <div key={i} className="flex justify-between items-center text-sm px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{r.label}</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">{fmt(r.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                <PiggyBank className="h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500">אין נכסים מתועדים במערכת</p>
              </div>
            )}
          </Block>

        </div>

        {/* ─── Row 4: Annual + YoY + Recommendations ─── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 md:gap-6">

          {/* Annual Chart with YoY comparison (Spans 2 cols) */}
          <Block colSpan={2} className="min-h-[340px]">
            <SectionTitle icon={<Target className="h-4 w-4" />} title={`השוואה שנתית — ${curYear} מול ${curYear - 1}`} link="/reports" linkLabel="דוחות מלאים" />
            {/* YoY KPI strip */}
            {yearly?.years?.[curYear] && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'הכנסות השנה', value: fmt(yearly.years[curYear].totalIncome), change: yearly.comparison?.incomeChange, good: true },
                  { label: 'הוצאות השנה', value: fmt(yearly.years[curYear].totalExpense), change: yearly.comparison?.expenseChange, good: false },
                  { label: 'חיסכון נטו', value: fmt(yearly.years[curYear].totalNet), change: null, positive: (yearly.years[curYear].totalNet ?? 0) >= 0 },
                  { label: 'שיעור חיסכון', value: `${(yearly.years[curYear].savingsRate ?? 0).toFixed(1)}%`, change: yearly.comparison?.savingsRateChange, good: true },
                ].map((k, i) => {
                  const pct = k.change != null ? k.change.toFixed(1) : null;
                  const up = k.change > 0;
                  const isGood = up ? k.good : !k.good;
                  return (
                    <div key={i} className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-slate-400 mb-1">{k.label}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{k.value}</p>
                      {pct != null && (
                        <p className={`text-[10px] font-semibold mt-0.5 flex items-center justify-center gap-0.5 ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
                          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(k.change).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex-1 w-full min-h-[200px]">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData.map((m, i) => ({
                    ...m,
                    'הכנסות קודם': yearly?.years?.[curYear - 1]?.monthly?.[i + 1]?.income ?? 0,
                    'הוצאות קודם': yearly?.years?.[curYear - 1]?.monthly?.[i + 1]?.expense ?? 0,
                  }))} barGap={1} barCategoryGap="20%" margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTheme.axis }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: chartTheme.axis }} width={40} />
                    <Tooltip contentStyle={chartTheme.tooltip} formatter={v => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="הכנסות" fill="#10b981" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="הוצאות" fill="#ef4444" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="הכנסות קודם" fill="#86efac" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="הוצאות קודם" fill="#fca5a5" radius={[2,2,0,0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">אין מספיק היסטוריה שנתית</div>
              )}
            </div>
          </Block>

          {/* AI Recommendations */}
          <Block colSpan={1}>
            <SectionTitle icon={<CheckCircle2 className="h-4 w-4" />} title="תובנות וייעול" link="/reports" linkLabel="הכל" />
            <div className="space-y-3 overflow-y-auto">
              {(recommendations || []).length > 0 ? recommendations.slice(0, 4).map((rec, i) => (
                <div key={i} className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 flex items-start gap-2.5">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${rec.priority === 'high' ? 'bg-red-500' : rec.priority === 'medium' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{rec.suggestion ?? rec.text ?? rec.title}</p>
                    {rec.potentialSavings && <p className="text-xs font-bold text-emerald-600 mt-1">חיסכון: {fmt(rec.potentialSavings)}</p>}
                  </div>
                </div>
              )) : (
                <div className="text-center text-slate-400 text-sm py-10">
                  <CheckCircle2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  הכל נראה תקין
                </div>
              )}
            </div>
          </Block>
        </div>

        {/* ─── Row 5: Category Trends ─── */}
        {(catTrends || []).length > 0 && (
          <Block colSpan={4} className="min-h-[300px]">
            <SectionTitle icon={<BarChart2 className="h-4 w-4" />} title="מגמות הוצאות לפי קטגוריה (6 חודשים)" link="/reports" linkLabel="דוחות" />
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={catTrends.map(m => {
                  const entry = { month: m.label || m.month };
                  (catTrendCategories || []).forEach(cat => { entry[cat] = m.categories?.[cat] || 0; });
                  return entry;
                })} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chartTheme.axis }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: chartTheme.axis }} width={40} />
                  <Tooltip contentStyle={chartTheme.tooltip} formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {(catTrendCategories || []).slice(0, 8).map((cat, i) => (
                    <Area key={cat} type="monotone" dataKey={cat} stackId="1" fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.5} strokeWidth={1} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Block>
        )}

        {/* ─── Row 6: Financial Summary Modules ─── */}
        {finSummary && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">תמונה פיננסית כוללת</h2>
              <Link to="/reports" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">סיכום מלא <ChevronLeft className="h-3 w-3" /></Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: 'פיקדונות',      value: finSummary.deposits?.totalAmount,       count: finSummary.deposits?.count,       color: 'text-blue-600',    link: '/deposits'        },
                { label: 'מניות',          value: finSummary.stocks?.totalValue,           count: finSummary.stocks?.count,          color: 'text-emerald-600', link: '/investments'     },
                { label: 'פנסיה',          value: finSummary.pension?.totalAccumulated,    count: finSummary.pension?.count,          color: 'text-violet-600',  link: '/pension'         },
                { label: 'הלוואות',        value: finSummary.loans?.totalRemaining,        count: finSummary.loans?.count,            color: 'text-red-600',     link: '/my-loans'        },
                { label: 'משכנתאות',       value: finSummary.mortgages?.totalBalance,      count: finSummary.mortgages?.count,        color: 'text-orange-600',  link: '/mortgage'        },
                { label: 'ביטוח/חודש',    value: finSummary.insurance?.monthlyCost,       count: finSummary.insurance?.count,        color: 'text-amber-600',   link: '/insurance'       },
                { label: 'נדל"ן',          value: finSummary.realEstate?.totalValue,       count: finSummary.realEstate?.count,       color: 'text-teal-600',    link: '/real-estate'     },
                { label: 'מט"ח',           value: finSummary.foreignCurrency?.totalILS,    count: finSummary.foreignCurrency?.count,  color: 'text-indigo-600',  link: '/foreign-currency'},
                { label: 'חיסכון ילדים',   value: finSummary.childSavings?.totalBalance,   count: finSummary.childSavings?.count,     color: 'text-pink-600',    link: '/child-savings'   },
              ].filter(m => m.value != null && m.value !== 0).map((m, i) => (
                <Link key={i} to={m.link} className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-4 hover:shadow-md transition-shadow flex flex-col gap-1">
                  <p className="text-xs text-slate-400">{m.label}</p>
                  <p className={`text-base font-bold tabular-nums ${m.color}`}>{fmt(m.value)}</p>
                  {m.count != null && <p className="text-[10px] text-slate-400">{m.count} רשומות</p>}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
