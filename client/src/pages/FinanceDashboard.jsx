import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Loader2,
  Wallet, BarChart2, Home, ChevronLeft, Target,
  ArrowUpRight, ArrowDownRight, Building2, CreditCard, Upload, PiggyBank,
  Activity, PieChart as PieChartIcon
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];
const fmt = formatCurrency;

// ─── UI Helpers ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, title, link, linkLabel }) {
  return (
    <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      </div>
      {link && (
        <Link to={link} className="text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-full">
          {linkLabel} <ChevronLeft className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, positive, loading, icon: Icon }) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        {Icon && <div className="bg-slate-50 p-1.5 rounded-md"><Icon className="h-4 w-4 text-slate-400" /></div>}
      </div>
      <div className="mt-2">
        {loading ? (
          <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className="text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
        )}
        {sub && !loading && (
          <p className={`text-xs font-semibold flex items-center gap-1 mt-1.5 ${positive === true ? 'text-emerald-600' : positive === false ? 'text-red-500' : 'text-slate-500'}`}>
            {positive === true && <ArrowUpRight className="h-3 w-3" />}
            {positive === false && <ArrowDownRight className="h-3 w-3" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function Block({ children, className = '', colSpan = 1, rowSpan = 1 }) {
  const colClasses = {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3',
    4: 'lg:col-span-4',
  };
  const rowClasses = {
    1: 'lg:row-span-1',
    2: 'lg:row-span-2',
  };
  return (
    <div className={`bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col ${colClasses[colSpan]} ${rowClasses[rowSpan]} ${className}`}>
      {children}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-slate-500 text-sm font-medium">טוען נתונים פיננסיים...</p>
      </div>
    );
  }

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
  const activeAlerts = (alerts || []).filter(a => !a.read).slice(0, 5);

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

  // Formatting for Assets Pie
  const assetRows = [
    { label: 'פיקדונות', value: netWorth?.deposits ?? 0 },
    { label: 'מניות', value: netWorth?.stocks ?? 0 },
    { label: 'קרנות', value: netWorth?.funds ?? 0 },
    { label: 'פנסיה', value: netWorth?.pension ?? 0 },
    { label: 'נדל"ן', value: netWorth?.realEstate ?? 0 },
  ].filter(r => r.value > 0);

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
  const histData = (nwHistory || []).map(h => ({
    name: h.date ? format(new Date(h.date), 'MMM yy', { locale: he }) : '',
    שווי: h.netWorth ?? h.value ?? 0,
  })).filter(h => h.name);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8 font-sans" dir="rtl">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              לוח בקרה מרכזי
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              מעודכן ל: {summary?.recentTransactions?.[0]?.date ? format(new Date(summary.recentTransactions[0].date), "dd.MM.yyyy") : 'היום'}
            </p>
          </div>
          <Link to="/import/auto" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm">
            <Upload className="h-4 w-4" /> ייבוא נתונים
          </Link>
        </div>

        {/* ─── Row 1: Key Performance Indicators (KPIs) ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard 
            label="שווי נקי כולל" value={fmt(netWorth?.totalNetWorth ?? 0)} 
            sub={healthScore ? `דירוג בריאות: ${healthScore.grade}` : null} 
            positive={(netWorth?.totalNetWorth ?? 0) >= 0} icon={Home} 
          />
          <StatCard 
            label="הכנסות החודש" value={fmt(income)} 
            sub={monthly?.prevMonth ? `חודש קודם: ${fmt(monthly.prevMonth.income)}` : null} 
            positive={income >= (monthly?.prevMonth?.income ?? 0)} icon={TrendingUp} 
          />
          <StatCard 
            label="הוצאות החודש" value={fmt(expense)} 
            sub={monthly?.prevMonth ? `חודש קודם: ${fmt(monthly.prevMonth.expense)}` : null} 
            positive={expense <= (monthly?.prevMonth?.expense ?? 0)} icon={TrendingDown} 
          />
          <StatCard 
            label="חיסכון נטו" value={fmt(netFlow)} 
            sub={savingsRate != null ? `שיעור חיסכון: ${savingsRate}%` : null} 
            positive={netFlow >= 0} icon={Wallet} 
          />
        </div>

        {/* ─── Row 2: Analytics & Budget (Current Focus) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          
          {/* Main Chart: Income vs Expenses Trend (Spans 2 cols) */}
          <Block colSpan={2} className="min-h-[380px]">
            <SectionTitle icon={<BarChart2 className="h-4 w-4" />} title="מגמות תזרים מזומנים (6 חודשים)" link="/smart-analytics" linkLabel="דו״ח מלא" />
            <div className="flex-1 w-full h-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChart} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#64748b' }} width={45} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="הכנסות" stroke="#10b981" fill="url(#colorInc)" strokeWidth={2} />
                  <Area type="monotone" dataKey="הוצאות" stroke="#ef4444" fill="url(#colorExp)" strokeWidth={2} />
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
                  <button key={i} onClick={() => navigate(`/portfolio?category=${encodeURIComponent(r.cat)}`)} className="w-full flex items-center justify-between group text-right hover:bg-slate-50 p-1.5 -mx-1.5 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{r.cat}</p>
                        <p className="text-xs text-slate-500">קודם: {fmt(r.previous)}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">{fmt(r.current)}</p>
                      <p className={`text-xs font-semibold ${isUp ? 'text-red-500' : 'text-emerald-600'}`}>
                        {r.delta !== null ? `${isUp ? '+' : ''}${r.delta}%` : 'חדש'}
                      </p>
                    </div>
                  </button>
                );
              }) : <p className="text-sm text-slate-500 text-center py-10">אין נתוני קטגוריות החודש</p>}
            </div>
          </Block>

          {/* Budget & Alerts (Spans 1 col) */}
          <Block colSpan={1} className="flex flex-col gap-6">
            <div className="flex-1">
              <SectionTitle icon={<Wallet className="h-4 w-4" />} title="ניצול תקציב" link="/budget" linkLabel="נהל" />
              <div className="space-y-4">
                {(budget?.categories ?? []).filter(c => c.limit > 0).slice(0, 4).map((cat, i) => {
                  const pct = Math.round((cat.actual / cat.limit) * 100);
                  const over = pct > 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-700">{cat.category}</span>
                        <span className={over ? 'text-red-500 font-semibold' : 'text-slate-500'}>{fmt(cat.actual)} / {fmt(cat.limit)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {(!budget?.categories || budget.categories.filter(c => c.limit > 0).length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-4">לא הוגדרו יעדי תקציב</p>
                )}
              </div>
            </div>
            {activeAlerts.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-bold text-slate-800">התראות פעילות</span>
                </div>
                <div className="space-y-2">
                  {activeAlerts.slice(0, 2).map((a, i) => (
                    <p key={i} className="text-sm text-slate-700 bg-red-50 border border-red-100 p-2.5 rounded-lg">{a.message ?? a.title}</p>
                  ))}
                </div>
              </div>
            )}
          </Block>

        </div>

        {/* ─── Row 3: Wealth & Assets ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          
          {/* Net Worth Growth Chart (Spans 2 cols) */}
          <Block colSpan={2} className="min-h-[350px]">
            <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="צמיחת שווי נקי (Net Worth)" link="/net-worth" linkLabel="מאזן מלא" />
            <div className="flex-1 w-full h-full min-h-[200px]">
              {histData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={histData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="nwColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#64748b' }} width={50} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={v => fmt(v)} />
                    <Area type="monotone" dataKey="שווי" stroke="#3b82f6" fill="url(#nwColor)" strokeWidth={3} />
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
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }} formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-500 font-bold">סך נכסים</span>
                    <span className="text-lg font-bold text-slate-900">{fmt(netWorth?.totalAssets ?? 0)}</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {assetRows.map((r, i) => (
                    <div key={i} className="flex justify-between items-center text-sm px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-700 font-medium">{r.label}</span>
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums">{fmt(r.value)}</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

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
                    <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-slate-400 mb-1">{k.label}</p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">{k.value}</p>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} formatter={v => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="הכנסות" fill="#10b981" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="הוצאות" fill="#ef4444" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="הכנסות קודם" fill="#86efac" radius={[2,2,0,0]} maxBarSize={14} />
                    <Bar dataKey="הוצאות קודם" fill="#fca5a5" radius={[2,2,0,0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">אין מספיק היסטוריה שנתית</div>
              )}
            </div>
          </Block>

          {/* AI Recommendations */}
          <Block colSpan={1}>
            <SectionTitle icon={<CheckCircle2 className="h-4 w-4" />} title="תובנות וייעול" link="/smart-analytics" linkLabel="הכל" />
            <div className="space-y-3 overflow-y-auto">
              {(recommendations || []).length > 0 ? recommendations.slice(0, 4).map((rec, i) => (
                <div key={i} className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${rec.priority === 'high' ? 'bg-red-500' : rec.priority === 'medium' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <div>
                    <p className="text-sm text-slate-700 leading-snug">{rec.suggestion ?? rec.text ?? rec.title}</p>
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748b' }} width={40} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} formatter={v => fmt(v)} />
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
              <h2 className="text-lg font-bold text-slate-800">תמונה פיננסית כוללת</h2>
              <Link to="/reports" className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">סיכום מלא <ChevronLeft className="h-3 w-3" /></Link>
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
                <Link key={i} to={m.link} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow flex flex-col gap-1">
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