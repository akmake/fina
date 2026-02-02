// client/src/pages/FinanceDashboard.jsx

import React, { useEffect, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  ArrowUp, 
  ArrowDown, 
  Wallet, 
  TrendingUp, 
  Activity, 
  CreditCard,
  Loader2,
  AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

// --- Imports from your project structure ---
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/Button';

// --- Helper Functions ---
const formatCurrency = (value) => 
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value || 0);

const StatCard = ({ title, value, change, changeType, icon: Icon, subText }) => (
  <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-200">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gray-50/50">
      <CardTitle className="text-sm font-semibold text-gray-600">{title}</CardTitle>
      {Icon && <Icon className="h-4 w-4 text-blue-500" />}
    </CardHeader>
    <CardContent className="pt-4">
      <div className="text-2xl font-bold tracking-tight text-gray-900">{formatCurrency(value)}</div>
      <div className="mt-2 flex items-center text-xs">
        {change !== undefined && (
          <span className={`flex items-center font-medium ${changeType === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
            {changeType === 'increase' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        <span className="text-gray-500 mr-2">{subText || "מהחודש שעבר"}</span>
      </div>
    </CardContent>
  </Card>
);

// --- Main Dashboard Component ---
export default function FinanceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: dashboardData } = await api.get('/dashboard/summary');
        setData(dashboardData);
      } catch (err) {
        console.error("Dashboard Error:", err);
        const errorMsg = err.response?.data?.message || 'שגיאה בטעינת הנתונים';
        setError(errorMsg);
        toast.error(errorMsg);
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
        <p className="text-gray-500 text-sm">טוען נתונים...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-600 gap-2">
        <AlertCircle className="h-10 w-10" />
        <p className="text-lg font-medium">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>נסה שוב</Button>
      </div>
    );
  }

  if (!data) return null;

  // חילוץ נתונים בטוח
  const { accounts = [], monthlySummary = {}, projects = [], balanceChartData = [] } = data;
  
  // חישובים
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  
  const thisMonthIncome = monthlySummary.thisMonth?.income || 0;
  const thisMonthExpense = monthlySummary.thisMonth?.expense || 0;
  const prevMonthIncome = monthlySummary.prevMonth?.income || 0;
  const prevMonthExpense = monthlySummary.prevMonth?.expense || 0;

  const thisMonthNet = thisMonthIncome - thisMonthExpense;
  const prevMonthNet = prevMonthIncome - prevMonthExpense;

  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const incomeChange = calculateChange(thisMonthIncome, prevMonthIncome);
  const expenseChange = calculateChange(thisMonthExpense, prevMonthExpense);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">לוח בקרה</h1>
          <p className="text-gray-500 mt-1">סקירה כללית של המצב הפיננסי שלך</p>
        </div>
        <div className="flex gap-2">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link to="/transactions">הוסף תנועה</Link>
            </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
          changeType={expenseChange <= 0 ? 'increase' : 'decrease'} // ירידה בהוצאות זה חיובי (ירוק)
          icon={CreditCard} 
        />
        <StatCard 
          title="תזרים נקי" 
          value={thisMonthNet} 
          change={prevMonthNet} 
          changeType={thisMonthNet >= prevMonthNet ? 'increase' : 'decrease'} 
          icon={Activity} 
          subText="הכנסות פחות הוצאות"
        />
      </section>

      {/* Main Content Grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        
        {/* Chart Section - Spans 2 columns */}
        <Card className="lg:col-span-2 shadow-md border-none">
          <CardHeader>
            <CardTitle>מגמת יתרה</CardTitle>
            <CardDescription>התפתחות העו"ש ב-30 הימים האחרונים</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: '#6b7280' }} 
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(val) => `₪${val / 1000}k`} 
                    tick={{ fontSize: 12, fill: '#6b7280' }} 
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
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

        {/* Right Column: Projects & Accounts */}
        <div className="space-y-6">
            
            {/* Accounts Summary */}
            <Card className="shadow-md border-none">
                <CardHeader>
                    <CardTitle>חשבונות בנק</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableBody>
                            {accounts.map((acc, i) => (
                                <TableRow key={acc._id || i} className="hover:bg-transparent">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                <Wallet size={16} />
                                            </div>
                                            {acc.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-left font-semibold text-gray-700">
                                        {formatCurrency(acc.balance)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Recent Projects */}
            <Card className="shadow-md border-none flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg">יעדים ופרויקטים</CardTitle>
                    <Link to="/projects" className="text-sm text-blue-600 hover:underline">הכל</Link>
                </CardHeader>
                <CardContent className="flex-1 space-y-5">
                    {projects.length > 0 ? (
                        projects.slice(0, 3).map((proj) => {
                            const percent = Math.min(100, Math.max(0, (proj.currentAmount / proj.targetAmount) * 100));
                            return (
                                <div key={proj._id} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-gray-700">{proj.projectName}</span>
                                        <span className="text-gray-500">{percent.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                                            style={{ width: `${percent}%` }} 
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>{formatCurrency(proj.currentAmount)}</span>
                                        <span>יעד: {formatCurrency(proj.targetAmount)}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-6 text-gray-400">
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