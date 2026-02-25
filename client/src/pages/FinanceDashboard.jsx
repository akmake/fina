import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowUp, ArrowDown, Wallet, TrendingUp, Activity, CreditCard,
  Loader2, AlertCircle, Plus, Scale, Heart, ChevronLeft, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
      <div className="text-lg sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
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
        <span className="text-gray-500 dark:text-slate-400 me-2">{subText || 'מהחודש שעבר'}</span>
      </div>
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FinanceDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [netWorth, setNetWorth] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashRes, nwRes, hsRes, alertsRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/net-worth').catch(() => ({ data: null })),
          api.get('/net-worth/health-score').catch(() => ({ data: null })),
          api.get('/alerts').catch(() => ({ data: [] })),
        ]);
        setData(dashRes.data);
        setNetWorth(nwRes.data);
        setHealthScore(hsRes.data);
        const alertsList = Array.isArray(alertsRes.data) ? alertsRes.data : (alertsRes.data?.alerts || []);
        setAlerts(alertsList.filter(a => !a.isRead).slice(0, 5));
      } catch (err) {
        console.error('Dashboard Error:', err);
        const msg = err.response?.data?.message || 'שגיאה בטעינת הנתונים';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">טוען נתונים...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-600 gap-3">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-medium">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>נסה שוב</Button>
      </div>
    );
  }

  if (!data) return null;

  const { accounts = [], monthlySummary = {}, projects = [], balanceChartData = [] } = data;

  const totalBalance      = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const thisMonthIncome   = monthlySummary.thisMonth?.income  || 0;
  const thisMonthExpense  = monthlySummary.thisMonth?.expense || 0;
  const prevMonthIncome   = monthlySummary.prevMonth?.income  || 0;
  const prevMonthExpense  = monthlySummary.prevMonth?.expense || 0;
  const thisMonthNet      = thisMonthIncome - thisMonthExpense;
  const prevMonthNet      = prevMonthIncome - prevMonthExpense;

  const calcChange = (cur, prev) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  const incomeChange  = calcChange(thisMonthIncome,  prevMonthIncome);
  const expenseChange = calcChange(thisMonthExpense, prevMonthExpense);
  const netChange     = calcChange(thisMonthNet,     prevMonthNet);

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 font-sans">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">לוח בקרה</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">סקירה כללית של המצב הפיננסי שלך</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 self-start sm:self-auto">
          <Link to="/portfolio">
            <Plus className="me-2 h-4 w-4" />
            הוסף תנועה
          </Link>
        </Button>
      </div>

      {/* Stats grid */}
      <section className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="יתרה כוללת"
          value={totalBalance}
          icon={Wallet}
          subText="בכל החשבונות"
        />
        <StatCard
          title="הכנסות החודש"
          value={thisMonthIncome}
          change={incomeChange}
          changeType={incomeChange >= 0 ? 'increase' : 'decrease'}
          icon={TrendingUp}
        />
        <StatCard
          title="הוצאות החודש"
          value={thisMonthExpense}
          change={expenseChange}
          changeType={expenseChange <= 0 ? 'increase' : 'decrease'}
          icon={CreditCard}
        />
        <StatCard
          title="תזרים נקי"
          value={thisMonthNet}
          change={netChange}
          changeType={thisMonthNet >= prevMonthNet ? 'increase' : 'decrease'}
          icon={Activity}
          subText="הכנסות פחות הוצאות"
        />
      </section>

      {/* Net Worth & Health Score Row */}
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

      {/* Alerts Widget */}
      {alerts.length > 0 && (
        <section>
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
                    a.severity === 'danger' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400' :
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
        </section>
      )}

      {/* Chart + side panel */}
      <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">

        {/* Balance trend chart */}
        <Card className="lg:col-span-2 shadow-md border-none dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-slate-100">מגמת יתרה</CardTitle>
            <CardDescription>התפתחות העו״ש ב-30 הימים האחרונים</CardDescription>
          </CardHeader>
          <CardContent className="ps-0">
            <div className="h-[250px] sm:h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceChartData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    tickFormatter={(val) => `₪${(val / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    dx={-5}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [formatCurrency(value), 'יתרה']}
                    labelStyle={{ color: '#374151', marginBottom: '0.5rem' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorBalance)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">

          {/* Accounts */}
          <Card className="shadow-md border-none dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-slate-100">חשבונות</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {accounts.map((acc, i) => (
                    <TableRow key={acc._id || i} className="hover:bg-transparent">
                      <TableCell className="font-medium dark:text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Wallet size={16} />
                          </div>
                          {acc.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-start font-semibold text-gray-700 dark:text-slate-300">
                        {formatCurrency(acc.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Projects */}
          <Card className="shadow-md border-none dark:bg-slate-900 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg dark:text-slate-100">יעדים ופרויקטים</CardTitle>
              <Link to="/projects" className="text-sm text-blue-600 hover:underline">הכל</Link>
            </CardHeader>
            <CardContent className="flex-1 space-y-5">
              {projects.length > 0 ? (
                projects.slice(0, 3).map((proj) => {
                  const percent = Math.min(100, Math.max(0, (proj.currentAmount / proj.targetAmount) * 100));
                  return (
                    <div key={proj._id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700 dark:text-slate-300">{proj.projectName}</span>
                        <span className="text-gray-500 dark:text-slate-400">{percent.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
                        <span>{formatCurrency(proj.currentAmount)}</span>
                        <span>יעד: {formatCurrency(proj.targetAmount)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
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
    </div>
  );
}
