import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ArrowUp, ArrowDown, Wallet, TrendingUp, Activity, CreditCard,
  Loader2, AlertCircle, Plus, Scale, Heart, ChevronLeft, Bell,
  Clock, PiggyBank, Shield, Lightbulb, X, CheckCircle2, Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';

import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

// ── Health Score Ring ──────────────────────────────────────────────────────────
const HealthRing = ({ score, max = 100 }) => {
  const pct = Math.min(1, score / max);
  const r = 32;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="w-20 h-20 flex-shrink-0">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="7" />
      <circle
        cx="40" cy="40" r={r} fill="none" stroke="white" strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 1.2s ease' }}
      />
      <text x="40" y="40" textAnchor="middle" dy="0.35em" fill="white" fontSize="17" fontWeight="bold">{score}</text>
    </svg>
  );
};

// ── Gradient Stat Card ─────────────────────────────────────────────────────────
const GradientStatCard = ({ title, value, change, changeType, icon: Icon, gradient, subText }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 shadow-lg ${gradient}`}>
    <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full bg-white opacity-10 pointer-events-none" />
    <div className="absolute -bottom-8 -left-4 w-28 h-28 rounded-full bg-white opacity-5 pointer-events-none" />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <span className="text-white/75 text-[11px] font-semibold uppercase tracking-widest">{title}</span>
        <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">{formatCurrency(value)}</div>
      {change !== undefined && (
        <div className="flex items-center gap-1 text-[11px] text-white/65">
          {changeType === 'increase' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          <span>{Math.abs(change).toFixed(1)}% {subText || 'לעומת חודש קודם'}</span>
        </div>
      )}
      {change === undefined && subText && (
        <div className="text-[11px] text-white/65">{subText}</div>
      )}
    </div>
  </div>
);

// ── Custom Chart Tooltip ───────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-100 shadow-2xl rounded-2xl px-4 py-3">
      <p className="text-[11px] font-semibold text-slate-400 mb-0.5">{label}</p>
      <p className="text-base font-bold text-slate-900">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FinanceDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [projects,     setProjects]     = useState([]);
  const [accounts,     setAccounts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [netWorth,        setNetWorth]        = useState(null);
  const [healthScore,     setHealthScore]     = useState(null);
  const [alerts,          setAlerts]          = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [actionPlan,      setActionPlan]      = useState([]);
  const [planDismissed,   setPlanDismissed]   = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [txRes, dashRes, nwRes, hsRes, alertsRes] = await Promise.all([
          api.get('/transactions'),
          api.get('/dashboard/summary'),
          api.get('/net-worth').catch(() => ({ data: null })),
          api.get('/net-worth/health-score').catch(() => ({ data: null })),
          api.get('/alerts').catch(() => ({ data: [] })),
        ]);
        setTransactions(txRes.data || []);
        setProjects(dashRes.data?.projects || []);
        setAccounts(dashRes.data?.accounts || []);
        setNetWorth(nwRes.data);
        setHealthScore(hsRes.data);
        const al = Array.isArray(alertsRes.data) ? alertsRes.data : (alertsRes.data?.alerts || []);
        setAlerts(al.filter(a => !a.isRead).slice(0, 5));
        api.post('/net-worth/snapshot').catch(() => {});
        api.get('/analytics/recommendations').then(r => {
          const recs = r.data?.data?.recommendations || [];
          setRecommendations(recs.filter(rec => rec.priority === 'high').slice(0, 3));
        }).catch(() => {});
        api.get('/analytics/action-plan').then(r => {
          setActionPlan(r.data?.data?.actions || []);
        }).catch(() => {});
      } catch (err) {
        const msg = err.response?.data?.message || 'שגיאה בטעינת הנתונים';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const effectiveMonth = useMemo(() => {
    if (!transactions.length) return new Date();
    const now = new Date();
    const hasNow = transactions.some(t =>
      isWithinInterval(new Date(t.date), { start: startOfMonth(now), end: endOfMonth(now) })
    );
    if (hasNow) return now;
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    return new Date(sorted[0].date);
  }, [transactions]);

  const stats = useMemo(() => {
    const thisStart = startOfMonth(effectiveMonth);
    const thisEnd   = endOfMonth(effectiveMonth);
    const prevStart = startOfMonth(subMonths(effectiveMonth, 1));
    const prevEnd   = endOfMonth(subMonths(effectiveMonth, 1));

    const thisTxns = transactions.filter(t => isWithinInterval(new Date(t.date), { start: thisStart, end: thisEnd }));
    const prevTxns = transactions.filter(t => isWithinInterval(new Date(t.date), { start: prevStart, end: prevEnd }));
    const sum = (txns, type) => txns.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);

    const thisIncome  = sum(thisTxns, 'הכנסה');
    const thisExpense = sum(thisTxns, 'הוצאה');
    const prevIncome  = sum(prevTxns, 'הכנסה');
    const prevExpense = sum(prevTxns, 'הוצאה');

    const catSums = {};
    thisTxns.filter(t => t.type === 'הוצאה').forEach(t => {
      const c = t.category || 'כללי';
      catSums[c] = (catSums[c] || 0) + t.amount;
    });
    const topCategories = Object.entries(catSums)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, total]) => ({ cat, total }));

    const chartStart = new Date(thisEnd);
    chartStart.setDate(chartStart.getDate() - 29);
    const dailyMap = {};
    transactions
      .filter(t => { const d = new Date(t.date); return d >= chartStart && d <= thisEnd; })
      .forEach(t => {
        const key = format(new Date(t.date), 'MM/dd');
        dailyMap[key] = (dailyMap[key] || 0) + (t.type === 'הכנסה' ? t.amount : -t.amount);
      });

    let cumulative = 0;
    const balanceChartData = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, delta]) => { cumulative += delta; return { date, balance: cumulative }; });

    return { thisIncome, thisExpense, prevIncome, prevExpense, topCategories, balanceChartData };
  }, [transactions, effectiveMonth]);

  const calcChange = (cur, prev) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / Math.abs(prev)) * 100;
  const isCurrentMonth = isWithinInterval(effectiveMonth, { start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
  const totalBalance  = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const thisNet       = stats.thisIncome - stats.thisExpense;
  const prevNet       = stats.prevIncome - stats.prevExpense;
  const incomeChange  = calcChange(stats.thisIncome,  stats.prevIncome);
  const expenseChange = calcChange(stats.thisExpense, stats.prevExpense);
  const netChange     = calcChange(thisNet, prevNet);
  const topCatTotal   = stats.topCategories.reduce((s, c) => s + c.total, 0);

  const savingsRate = stats.thisIncome > 0 ? ((stats.thisIncome - stats.thisExpense) / stats.thisIncome) * 100 : 0;
  const liquidBalance     = netWorth?.assets?.totalLiquid ?? totalBalance;
  const avgMonthlyExpense = stats.thisExpense > 0 ? stats.thisExpense : (stats.prevExpense || 1);
  const emergencyMonths   = avgMonthlyExpense > 0 ? liquidBalance / avgMonthlyExpense : 0;

  const recentTxns = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  const CAT_COLORS = [
    { bar: 'from-blue-500 to-indigo-600',   dot: '#3b82f6' },
    { bar: 'from-violet-500 to-purple-600', dot: '#8b5cf6' },
    { bar: 'from-amber-400 to-orange-500',  dot: '#f59e0b' },
    { bar: 'from-emerald-500 to-teal-500',  dot: '#10b981' },
    { bar: 'from-rose-500 to-red-500',      dot: '#ef4444' },
  ];

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      <p className="text-slate-400 text-sm">טוען נתונים...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-red-500 gap-3">
      <AlertCircle className="h-10 w-10" />
      <p className="text-lg font-medium">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>נסה שוב</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-3 sm:p-6 md:p-8 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">לוח בקרה</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {format(effectiveMonth, 'MMMM yyyy', { locale: he })}
              {!isCurrentMonth && <span className="mr-2 text-amber-500 text-xs">· אין נתונים לחודש הנוכחי</span>}
            </p>
          </div>
          <Button
            asChild
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0 text-white rounded-xl shadow-md shadow-blue-200/60 transition-all duration-200 hover:shadow-lg hover:shadow-blue-300/50"
          >
            <Link to="/portfolio"><Plus className="me-2 h-4 w-4" />הוסף תנועה</Link>
          </Button>
        </div>

        {/* ── Hero Card ──────────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 sm:p-8 shadow-2xl shadow-indigo-200/60 overflow-hidden">
          {/* decorative blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-8 right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-8 left-12 w-64 h-40 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.07),transparent_60%)]" />
          </div>

          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {/* Health score */}
            <div className="flex items-center gap-4">
              {healthScore
                ? <HealthRing score={healthScore.totalScore} max={healthScore.maxPossible} />
                : <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><Heart className="h-7 w-7 text-white/40" /></div>
              }
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">בריאות פיננסית</p>
                {healthScore
                  ? <>
                      <p className="text-white font-bold text-base leading-tight">{healthScore.grade} — {healthScore.gradeLabel}</p>
                      {healthScore.tips?.[0] && <p className="text-white/55 text-xs mt-1 leading-relaxed max-w-[160px]">{healthScore.tips[0].tip}</p>}
                    </>
                  : <p className="text-white/40 text-sm">אין נתונים</p>
                }
              </div>
            </div>

            {/* Net flow */}
            <div className="flex flex-col justify-center sm:items-center">
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-2">תזרים חודשי נטו</p>
              <p className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${thisNet >= 0 ? 'text-white' : 'text-red-300'}`}>
                {thisNet >= 0 ? '+' : ''}{formatCurrency(thisNet)}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1 text-emerald-300 text-sm font-semibold">
                  <ArrowUp className="h-3.5 w-3.5" />{formatCurrency(stats.thisIncome)}
                </span>
                <span className="flex items-center gap-1 text-red-300 text-sm font-semibold">
                  <ArrowDown className="h-3.5 w-3.5" />{formatCurrency(stats.thisExpense)}
                </span>
              </div>
            </div>

            {/* Savings + Emergency + Net Worth */}
            <div className="flex flex-col justify-center space-y-3">
              {/* Savings Rate */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/60 text-xs flex items-center gap-1.5"><PiggyBank className="h-3 w-3" />שיעור חיסכון</span>
                  <span className={`text-sm font-bold ${savingsRate >= 20 ? 'text-emerald-300' : savingsRate >= 10 ? 'text-amber-300' : 'text-red-300'}`}>
                    {savingsRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${savingsRate >= 20 ? 'bg-emerald-400' : savingsRate >= 10 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
                  />
                </div>
              </div>

              {/* Emergency Fund */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/60 text-xs flex items-center gap-1.5"><Shield className="h-3 w-3" />קרן חירום</span>
                  <span className={`text-sm font-bold ${emergencyMonths >= 6 ? 'text-emerald-300' : emergencyMonths >= 3 ? 'text-amber-300' : 'text-red-300'}`}>
                    {emergencyMonths.toFixed(1)} חודשים
                  </span>
                </div>
                <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${emergencyMonths >= 6 ? 'bg-emerald-400' : emergencyMonths >= 3 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, (emergencyMonths / 6) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Net Worth */}
              {netWorth && (
                <Link to="/net-worth" className="flex items-center justify-between bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-3 py-2 mt-1">
                  <span className="text-white/60 text-xs flex items-center gap-1.5"><Scale className="h-3 w-3" />שווי נקי</span>
                  <span className={`text-sm font-bold ${netWorth.netWorth >= 0 ? 'text-white' : 'text-red-300'}`}>
                    {formatCurrency(netWorth.netWorth)}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Action Plan ────────────────────────────────────────────────────── */}
        {actionPlan.length > 0 && !planDismissed && (
          <div className="bg-gradient-to-br from-indigo-50/80 to-white/80 backdrop-blur-sm border border-indigo-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-bold text-indigo-800 text-sm">תוכנית פעולה לחודש זה</p>
                  <p className="text-xs text-indigo-400">צעדים ספציפיים עם סכומים</p>
                </div>
              </div>
              <button onClick={() => setPlanDismissed(true)} className="text-slate-300 hover:text-slate-500 transition-colors p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {actionPlan.map((action, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-2xl border ${
                  action.priority === 'high'   ? 'bg-red-50/70 border-red-100'    :
                  action.priority === 'medium' ? 'bg-amber-50/70 border-amber-100' :
                                                 'bg-blue-50/70 border-blue-100'
                }`}>
                  <span className="text-xl flex-shrink-0">{action.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-slate-800">{action.title}</p>
                      {action.amount != null && (
                        <span className={`text-sm font-bold flex-shrink-0 ${
                          action.priority === 'high' ? 'text-red-600' : action.priority === 'medium' ? 'text-amber-600' : 'text-blue-600'
                        }`}>₪{action.amount.toLocaleString()}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{action.description}</p>
                    {action.actionUrl && (
                      <Link to={action.actionUrl} className="inline-block mt-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                        {action.actionLabel} ←
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <GradientStatCard title="יתרה כוללת"   value={totalBalance}       icon={Wallet}      gradient="bg-gradient-to-br from-blue-500 to-blue-700"       subText="בכל החשבונות" />
          <GradientStatCard title="הכנסות החודש" value={stats.thisIncome}   icon={TrendingUp}  gradient="bg-gradient-to-br from-emerald-500 to-teal-600"    change={incomeChange}  changeType={incomeChange  >= 0 ? 'increase' : 'decrease'} />
          <GradientStatCard title="הוצאות החודש" value={stats.thisExpense}  icon={CreditCard}  gradient="bg-gradient-to-br from-orange-500 to-red-500"      change={expenseChange} changeType={expenseChange <= 0 ? 'increase' : 'decrease'} />
          <GradientStatCard title="תזרים נקי"    value={thisNet}            icon={Activity}    gradient="bg-gradient-to-br from-violet-600 to-purple-700"   change={netChange}     changeType={thisNet >= prevNet ? 'increase' : 'decrease'} subText="הכנסות פחות הוצאות" />
        </section>

        {/* ── Alerts ─────────────────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-amber-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-bold text-slate-800">התראות ({alerts.length})</span>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs text-blue-600">
                <Link to="/alerts">הצג הכל <ChevronLeft className="h-3 w-3 ms-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a._id} className={`flex items-start gap-2.5 text-sm px-3 py-2.5 rounded-2xl ${
                  a.severity === 'danger'  ? 'bg-red-50 text-red-700'    :
                  a.severity === 'warning' ? 'bg-amber-50 text-amber-700' :
                                             'bg-blue-50 text-blue-700'
                }`}>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-xs leading-relaxed">{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recommendations ────────────────────────────────────────────────── */}
        {recommendations.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-indigo-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Lightbulb className="h-4 w-4 text-indigo-600" />
                </div>
                <span className="font-bold text-slate-800">המלצות דחופות</span>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs text-blue-600">
                <Link to="/smart-analytics">הצג הכל <ChevronLeft className="h-3 w-3 ms-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-2xl bg-red-50 text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">{rec.suggestion}</p>
                    {rec.actionUrl && (
                      <Link to={rec.actionUrl} className="text-xs font-semibold text-indigo-600 hover:underline mt-0.5 block">{rec.actionLabel}</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Chart + Accounts/Goals ─────────────────────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Area Chart */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-slate-900 text-lg tracking-tight">מגמת תזרים</h2>
                <p className="text-slate-400 text-sm">{format(effectiveMonth, 'MMMM yyyy', { locale: he })}</p>
              </div>
            </div>
            {stats.balanceChartData.length > 0 ? (
              <div className="h-[240px] sm:h-[270px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.balanceChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false} dy={8}
                    />
                    <YAxis
                      tickFormatter={v => `₪${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false} width={44}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone" dataKey="balance"
                      stroke="#6366f1" strokeWidth={2.5}
                      fillOpacity={1} fill="url(#balGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#6366f1', stroke: 'white', strokeWidth: 2.5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-300 text-sm">
                אין נתונים לגרף
              </div>
            )}
          </div>

          {/* Accounts + Goals */}
          <div className="flex flex-col gap-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-5 flex-1">
              <h2 className="font-bold text-slate-900 mb-4">חשבונות</h2>
              <div className="space-y-3">
                {accounts.length === 0 && <p className="text-slate-300 text-sm text-center py-3">אין חשבונות</p>}
                {accounts.map((acc, i) => (
                  <div key={acc._id || i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{acc.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums text-sm">{formatCurrency(acc.balance)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-5 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900">יעדים</h2>
                <Link to="/projects" className="text-xs text-blue-600 hover:underline font-medium">הכל</Link>
              </div>
              {projects.length === 0 ? (
                <div className="text-center py-4">
                  <Target className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs mb-2">אין יעדים פעילים</p>
                  <Button variant="outline" size="sm" asChild className="rounded-xl text-xs">
                    <Link to="/projects/new">צור יעד חדש</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.slice(0, 3).map(proj => {
                    const pct = Math.min(100, Math.max(0, (proj.currentAmount / proj.targetAmount) * 100));
                    return (
                      <div key={proj._id}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-700 truncate">{proj.projectName}</span>
                          <span className="text-slate-400 flex-shrink-0 mr-2">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>{formatCurrency(proj.currentAmount)}</span>
                          <span>יעד: {formatCurrency(proj.targetAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Categories + Recent Transactions ───────────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-2">

          {/* Categories */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-slate-900 text-lg tracking-tight">הוצאות לפי קטגוריה</h2>
              <Link to="/categories" className="text-xs text-blue-600 hover:underline font-medium">פירוט</Link>
            </div>
            {stats.topCategories.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-8">אין נתונים לחודש זה</p>
            ) : (
              <div className="space-y-4">
                {stats.topCategories.map(({ cat, total }, i) => {
                  const pct = topCatTotal > 0 ? (total / topCatTotal) * 100 : 0;
                  const c = CAT_COLORS[i % CAT_COLORS.length];
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
                          <span className="font-semibold text-slate-700">{cat}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-slate-400 tabular-nums">{pct.toFixed(0)}%</span>
                          <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-slate-900 text-lg tracking-tight">עסקאות אחרונות</h2>
              <Link to="/portfolio" className="text-xs text-blue-600 hover:underline font-medium">הכל</Link>
            </div>
            {recentTxns.length === 0 ? (
              <p className="text-slate-300 text-sm text-center py-8">אין עסקאות</p>
            ) : (
              <div className="space-y-1">
                {recentTxns.map((t, i) => (
                  <div key={t._id || i} className="flex items-center gap-3 px-1 py-2.5 rounded-2xl hover:bg-slate-50/80 transition-colors group">
                    <div className={`h-9 w-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      t.type === 'הכנסה' ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      {t.type === 'הכנסה'
                        ? <ArrowUp className="h-4 w-4 text-emerald-500" />
                        : <ArrowDown className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{t.description}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {t.category && <span>{t.category} · </span>}
                        {format(new Date(t.date), 'd MMM', { locale: he })}
                      </p>
                    </div>
                    <span className={`font-bold text-sm tabular-nums flex-shrink-0 ${
                      t.type === 'הכנסה' ? 'text-emerald-600' : 'text-slate-700'
                    }`}>
                      {t.type === 'הכנסה' ? '+' : ''}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
