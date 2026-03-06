import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowUp, ArrowDown, Wallet, TrendingUp, Activity, CreditCard,
  Loader2, AlertCircle, Plus, Scale, Heart, ChevronLeft, Bell,
  PieChart, Clock, PiggyBank, Shield, Lightbulb,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';

import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
const StatCard = ({ title, value, change, changeType, icon: Icon, subText }) => (
  <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-200 dark:bg-slate-900">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gray-50/50 dark:bg-slate-800/50 p-3 sm:p-4">
      <CardTitle className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-400">{title}</CardTitle>
      {Icon && <Icon className="h-4 w-4 text-blue-500 flex-shrink-0" />}
    </CardHeader>
    <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4">
      <div className={`text-lg sm:text-2xl font-bold tracking-tight ${value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-100'}`}>
        {formatCurrency(value)}
      </div>
      <div className="mt-1 sm:mt-2 flex items-center text-xs">
        {change !== undefined && (
          <span className={`flex items-center font-medium ${changeType === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
            {changeType === 'increase'
              ? <ArrowUp className="h-3 w-3 ms-1" />
              : <ArrowDown className="h-3 w-3 ms-1" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        <span className="text-gray-500 dark:text-slate-400 me-2">{subText || 'לעומת חודש קודם'}</span>
      </div>
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FinanceDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [projects,     setProjects]     = useState([]);
  const [accounts,     setAccounts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [netWorth,       setNetWorth]       = useState(null);
  const [healthScore,    setHealthScore]    = useState(null);
  const [alerts,         setAlerts]         = useState([]);
  const [recommendations,setRecommendations]= useState([]);

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
        // שמירת תמונת מצב חודשית (ברקע, ללא חסימה)
        api.post('/net-worth/snapshot').catch(() => {});
        // המלצות ברקע
        api.get('/analytics/recommendations').then(r => {
          const recs = r.data?.data?.recommendations || [];
          setRecommendations(recs.filter(rec => rec.priority === 'high').slice(0, 3));
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

  // Find effective month — most recent with data
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

  // Compute stats client-side (always correct regardless of month)
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

    // Top categories
    const catSums = {};
    thisTxns.filter(t => t.type === 'הוצאה').forEach(t => {
      const c = t.category || 'כללי';
      catSums[c] = (catSums[c] || 0) + t.amount;
    });
    const topCategories = Object.entries(catSums)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, total]) => ({ cat, total }));

    // Balance trend (last 30 days from effectiveMonth end)
    const chartStart = new Date(thisEnd);
    chartStart.setDate(chartStart.getDate() - 29);
    const dailyMap = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return d >= chartStart && d <= thisEnd;
      })
      .forEach(t => {
        const key = format(new Date(t.date), 'MM/dd');
        const delta = t.type === 'הכנסה' ? t.amount : -t.amount;
        dailyMap[key] = (dailyMap[key] || 0) + delta;
      });

    let cumulative = 0;
    const balanceChartData = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, delta]) => { cumulative += delta; return { date, balance: cumulative }; });

    return { thisIncome, thisExpense, prevIncome, prevExpense, topCategories, balanceChartData };
  }, [transactions, effectiveMonth]);

  const calcChange = (cur, prev) => prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / Math.abs(prev)) * 100;

  const isCurrentMonth = isWithinInterval(effectiveMonth, {
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  const totalBalance   = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const thisNet        = stats.thisIncome - stats.thisExpense;
  const prevNet        = stats.prevIncome - stats.prevExpense;
  const incomeChange   = calcChange(stats.thisIncome,  stats.prevIncome);
  const expenseChange  = calcChange(stats.thisExpense, stats.prevExpense);
  const netChange      = calcChange(thisNet, prevNet);
  const topCatTotal    = stats.topCategories.reduce((s, c) => s + c.total, 0);

  // שיעור חיסכון (Savings Rate)
  const savingsRate = stats.thisIncome > 0
    ? ((stats.thisIncome - stats.thisExpense) / stats.thisIncome) * 100
    : 0;
  const savingsRateColor =
    savingsRate >= 20 ? 'text-green-600' :
    savingsRate >= 10 ? 'text-amber-500' :
    'text-red-600';

  // קרן חירום — חודשי הוצאות ברמת הנזילות
  const liquidBalance      = netWorth?.assets?.totalLiquid ?? totalBalance;
  const avgMonthlyExpense  = stats.thisExpense > 0 ? stats.thisExpense : (stats.prevExpense || 1);
  const emergencyMonths    = avgMonthlyExpense > 0 ? liquidBalance / avgMonthlyExpense : 0;
  const emergencyColor =
    emergencyMonths >= 6 ? 'text-green-600' :
    emergencyMonths >= 3 ? 'text-amber-500' :
    'text-red-600';

  const recentTxns = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      <p className="text-gray-500 dark:text-slate-400 text-sm">טוען נתונים...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-red-600 gap-3">
      <AlertCircle className="h-10 w-10" />
      <p className="text-lg font-medium">{error}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>נסה שוב</Button>
    </div>
  );

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 font-sans" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">לוח בקרה</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {format(effectiveMonth, 'MMMM yyyy', { locale: he })}
            {!isCurrentMonth && <span className="mr-2 text-amber-500 text-sm">· אין נתונים לחודש הנוכחי</span>}
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 self-start sm:self-auto">
          <Link to="/portfolio"><Plus className="me-2 h-4 w-4" />הוסף תנועה</Link>
        </Button>
      </div>

      {/* Stats grid */}
      <section className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <StatCard title="יתרה כוללת"    value={totalBalance}        icon={Wallet}      subText="בכל החשבונות" />
        <StatCard title="הכנסות החודש"  value={stats.thisIncome}    icon={TrendingUp}  change={incomeChange}  changeType={incomeChange  >= 0 ? 'increase' : 'decrease'} />
        <StatCard title="הוצאות החודש"  value={stats.thisExpense}   icon={CreditCard}  change={expenseChange} changeType={expenseChange <= 0 ? 'increase' : 'decrease'} />
        <StatCard title="תזרים נקי"     value={thisNet}             icon={Activity}    change={netChange}     changeType={thisNet >= prevNet ? 'increase' : 'decrease'} subText="הכנסות פחות הוצאות" />
      </section>

      {/* Economic indicators — savings rate & emergency fund */}
      <section className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2">
        <Card className="overflow-hidden border-none shadow-md dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gray-50/50 dark:bg-slate-800/50 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-400">שיעור חיסכון חודשי</CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4">
            <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${savingsRateColor}`}>
              {savingsRate.toFixed(1)}%
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {savingsRate >= 20
                ? 'מצוין! מעל 20% — רמה כלכלית אידיאלית'
                : savingsRate >= 10
                  ? 'טוב — כוון ל-20% לצמיחה מהירה'
                  : savingsRate >= 0
                    ? 'נמוך — נסה לחסוך לפחות 10% מההכנסה'
                    : 'גירעון — הוצאות עולות על הכנסות'}
            </div>
            <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${savingsRate >= 20 ? 'bg-green-500' : savingsRate >= 10 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Link to="/net-worth">
          <Card className="overflow-hidden border-none shadow-md dark:bg-slate-900 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gray-50/50 dark:bg-slate-800/50 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-400">קרן חירום</CardTitle>
              <Shield className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4">
              <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${emergencyColor}`}>
                {emergencyMonths.toFixed(1)} חודשים
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                {emergencyMonths >= 6
                  ? 'בטוח — יש לך כרית ביטחון מצוינת'
                  : emergencyMonths >= 3
                    ? 'סביר — כוון ל-6 חודשי הוצאות'
                    : 'בסיכון — פחות מ-3 חודשים נזילים'}
              </div>
              <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${emergencyMonths >= 6 ? 'bg-green-500' : emergencyMonths >= 3 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, (emergencyMonths / 6) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Net Worth & Health Score */}
      {(netWorth || healthScore) && (
        <section className="grid gap-3 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {netWorth && (
            <Link to="/net-worth">
              <Card className="shadow-md border-none dark:bg-slate-900 hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Scale className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">שווי נקי</span>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className={`text-2xl sm:text-3xl font-bold ${netWorth.netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netWorth.netWorth)}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span>נכסים: {formatCurrency(netWorth.assets?.total || 0)}</span>
                    <span>התחייבויות: {formatCurrency(netWorth.liabilities?.total || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {healthScore && (
            <Link to="/net-worth">
              <Card className="shadow-md border-none dark:bg-slate-900 hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">בריאות פיננסית</span>
                    </div>
                    <Badge style={{ backgroundColor: healthScore.gradeColor, color: 'white' }}>
                      {healthScore.grade} – {healthScore.gradeLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-extrabold" style={{ color: healthScore.gradeColor }}>
                      {healthScore.totalScore}
                    </div>
                    <div className="flex-1">
                      <Progress value={(healthScore.totalScore / healthScore.maxPossible) * 100} className="h-3" />
                      <p className="text-xs text-slate-400 mt-1">מתוך {healthScore.maxPossible} נקודות</p>
                    </div>
                  </div>
                  {healthScore.tips?.[0] && (
                    <p className="text-xs text-slate-500 mt-2 truncate">💡 {healthScore.tips[0].tip}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          )}
        </section>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="shadow-md border-none dark:bg-slate-900 border-r-4 border-r-amber-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">התראות ({alerts.length})</span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/alerts">הצג הכל <ChevronLeft className="h-3 w-3 ms-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a._id} className={`flex items-start gap-2 text-sm p-2 rounded ${
                  a.severity === 'danger'  ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400' :
                  a.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                  'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                }`}>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Recommendations */}
      {recommendations.length > 0 && (
        <Card className="shadow-md border-none dark:bg-slate-900 border-r-4 border-r-indigo-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-indigo-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">המלצות דחופות</span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/smart-analytics">הצג הכל <ChevronLeft className="h-3 w-3 ms-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span>{rec.suggestion}</span>
                    {rec.actionUrl && (
                      <Link to={rec.actionUrl} className="mr-2 text-xs underline text-indigo-600 dark:text-indigo-400">
                        {rec.actionLabel}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart + accounts */}
      <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-none dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-slate-100">מגמת תזרים</CardTitle>
            <CardDescription>{format(effectiveMonth, 'MMMM yyyy', { locale: he })}</CardDescription>
          </CardHeader>
          <CardContent className="ps-0">
            {stats.balanceChartData.length > 0 ? (
              <div className="h-[250px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.balanceChartData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tickFormatter={v => `₪${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} dx={-5} width={45} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={v => [formatCurrency(v), 'תזרים נקי']}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#cg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
                אין נתונים לגרף בחודש זה
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-md border-none dark:bg-slate-900">
            <CardHeader><CardTitle className="dark:text-slate-100">חשבונות</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <tbody>
                  {accounts.map((acc, i) => (
                    <tr key={acc._id || i} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium dark:text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Wallet size={16} />
                          </div>
                          {acc.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-700 dark:text-slate-300">
                        {formatCurrency(acc.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-md border-none dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg dark:text-slate-100">יעדים</CardTitle>
              <Link to="/projects" className="text-sm text-blue-600 hover:underline">הכל</Link>
            </CardHeader>
            <CardContent className="space-y-5">
              {projects.length > 0 ? projects.slice(0, 3).map(proj => {
                const pct = Math.min(100, Math.max(0, (proj.currentAmount / proj.targetAmount) * 100));
                return (
                  <div key={proj._id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700 dark:text-slate-300">{proj.projectName}</span>
                      <span className="text-gray-500 dark:text-slate-400">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{formatCurrency(proj.currentAmount)}</span>
                      <span>יעד: {formatCurrency(proj.targetAmount)}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-6 text-gray-400 dark:text-slate-500">
                  <p>אין יעדים פעילים</p>
                  <Button variant="link" asChild className="mt-2 text-blue-500">
                    <Link to="/projects/new">צור יעד חדש</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Categories + Recent transactions */}
      <section className="grid gap-4 sm:gap-6 lg:grid-cols-2">

        <Card className="shadow-md border-none dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-500" />
              <CardTitle className="dark:text-slate-100">הוצאות לפי קטגוריה</CardTitle>
            </div>
            <Link to="/categories" className="text-sm text-blue-600 hover:underline">פירוט</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topCategories.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">אין נתונים</p>
            ) : stats.topCategories.map(({ cat, total }, i) => {
              const pct = topCatTotal > 0 ? (total / topCatTotal) * 100 : 0;
              const colors = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444'];
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[i] }} />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{cat}</span>
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i] }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 text-end">{pct.toFixed(1)}%</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-md border-none dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <CardTitle className="dark:text-slate-100">עסקאות אחרונות</CardTitle>
            </div>
            <Link to="/portfolio" className="text-sm text-blue-600 hover:underline">הכל</Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentTxns.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">אין עסקאות</p>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {recentTxns.map((t, i) => (
                  <div key={t._id || i} className="flex items-center gap-3 px-5 py-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                      t.type === 'הכנסה' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {t.type === 'הכנסה' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{t.description}</p>
                      <p className="text-xs text-slate-400">
                        {t.category && <span>{t.category} · </span>}
                        {format(new Date(t.date), 'dd/MM/yy')}
                      </p>
                    </div>
                    <span className={`font-semibold tabular-nums text-sm flex-shrink-0 ${
                      t.type === 'הכנסה' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {t.type === 'הכנסה' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </section>
    </div>
  );
}
