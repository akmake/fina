// client/src/pages/FinanceDashboard.jsx

import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUp, ArrowDown, Wallet, Landmark, TrendingUp, Briefcase, LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// --- Imports from your project structure ---
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// --- Helper Functions ---
const formatCurrency = (value) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(value || 0);

const StatCard = ({ title, value, change, icon: Icon, changeType }) => (
    <Card className="dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(value)}</div>
            {change !== undefined && (
                <p className={`text-xs ${changeType === 'increase' ? 'text-green-600' : 'text-red-600'} flex items-center`}>
                    {changeType === 'increase' ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                    {change.toFixed(2)}% מהחודש שעבר
                </p>
            )}
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
                const errorMsg = err.response?.data?.message || 'שגיאה בטעינת נתוני הדשבורד';
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
            <div className="flex justify-center items-center h-[calc(100vh-8rem)]">
                <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg">{error}</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-gray-500">לא נמצאו נתונים להצגה.</div>;
    }

    const { accounts, monthlySummary, projects, balanceChartData } = data;
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const thisMonthNet = monthlySummary.thisMonth.income - monthlySummary.thisMonth.expense;
    const prevMonthNet = monthlySummary.prevMonth.income - monthlySummary.prevMonth.expense;
    
    const incomeChange = monthlySummary.prevMonth.income > 0
        ? ((monthlySummary.thisMonth.income - monthlySummary.prevMonth.income) / monthlySummary.prevMonth.income) * 100
        : monthlySummary.thisMonth.income > 0 ? 100 : 0;
        
    const expenseChange = monthlySummary.prevMonth.expense > 0
        ? ((monthlySummary.thisMonth.expense - monthlySummary.prevMonth.expense) / monthlySummary.prevMonth.expense) * 100
        : monthlySummary.thisMonth.expense > 0 ? 100 : 0;


    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">דשבורד פיננסי</h1>
                <p className="mt-1 text-lg text-gray-600 dark:text-slate-400">סקירה כללית של המצב הפיננסי שלך.</p>
            </header>

            {/* --- Stats Cards --- */}
            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="יתרה כוללת" value={totalBalance} icon={Wallet} />
                <StatCard title="הכנסות החודש" value={monthlySummary.thisMonth.income} change={incomeChange} changeType={incomeChange >= 0 ? 'increase' : 'decrease'} icon={TrendingUp} />
                <StatCard title="הוצאות החודש" value={monthlySummary.thisMonth.expense} change={expenseChange} changeType={expenseChange >= 0 ? 'increase' : 'decrease'} icon={TrendingUp} />
                <StatCard title="מאזן חודשי" value={thisMonthNet} change={prevMonthNet} changeType={thisMonthNet >= prevMonthNet ? 'increase' : 'decrease'} icon={Landmark} />
            </section>

            {/* --- Charts and Tables --- */}
            <section className="grid gap-8 lg:grid-cols-3">
                {/* Balance Chart */}
                <Card className="lg:col-span-2 dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle>התפתחות היתרה</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={balanceChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                        fontSize: '12px',
                                        direction: 'rtl'
                                    }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Line type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Accounts Summary */}
                <Card className="dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle>סיכום חשבונות</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>חשבון</TableHead>
                                    <TableHead className="text-left">יתרה</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accounts.map(acc => (
                                    <TableRow key={acc._id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell className="text-left">{formatCurrency(acc.balance)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </section>

             {/* --- Recent Projects --- */}
            <section>
                <Card className="dark:bg-slate-900">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>פרויקטים אחרונים</CardTitle>
                        <Button asChild variant="ghost" size="sm">
                            <Link to="/projects">כל הפרויקטים</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {projects.slice(0, 3).map(proj => (
                                <Link to={`/projects/${proj._id}`} key={proj._id} className="block p-4 rounded-lg border dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{proj.projectName}</p>
                                        <p className="text-sm text-muted-foreground">{new Date(proj.createdAt).toLocaleDateString('he-IL')}</p>
                                    </div>
                                     <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(proj.currentAmount / proj.targetAmount) * 100}%` }}></div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 text-left">{formatCurrency(proj.currentAmount)} / {formatCurrency(proj.targetAmount)}</p>
                                </Link>
                            ))}
                             {projects.length === 0 && (
                                <p className="text-center text-muted-foreground py-4">אין פרויקטים פעילים כרגע.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}