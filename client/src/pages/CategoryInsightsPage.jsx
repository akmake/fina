import React, { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Tag, X, Loader2 } from 'lucide-react';

const formatCurrency = (n) =>
    new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const CATEGORY_COLORS = [
    '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981',
    '#ef4444', '#06b6d4', '#f97316', '#84cc16',
];

export default function CategoryInsightsPage() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        // default to current date
        return new Date();
    });
    const [selectedCategory, setSelectedCategory] = useState(null);

    useEffect(() => {
        api.get('/transactions')
            .then(r => {
                const data = r.data || [];
                setTransactions(data);
                // If current month has no data, jump to most recent month with data
                if (data.length > 0) {
                    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
                    const mostRecent = new Date(sorted[0].date);
                    const now = new Date();
                    const currentHasData = data.some(t =>
                        isWithinInterval(new Date(t.date), { start: startOfMonth(now), end: endOfMonth(now) })
                    );
                    if (!currentHasData) setSelectedMonth(mostRecent);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const getMonthTxns = (date) =>
        transactions.filter(t =>
            isWithinInterval(new Date(t.date), { start: startOfMonth(date), end: endOfMonth(date) })
        );

    const currentTxns = useMemo(() => getMonthTxns(selectedMonth), [transactions, selectedMonth]);
    const prevTxns    = useMemo(() => getMonthTxns(subMonths(selectedMonth, 1)), [transactions, selectedMonth]);

    // Category totals — expenses only
    const buildStats = (txns) => {
        const s = {};
        txns.filter(t => t.type === 'הוצאה').forEach(t => {
            const c = t.category || 'כללי';
            if (!s[c]) s[c] = { amount: 0, count: 0 };
            s[c].amount += t.amount;
            s[c].count++;
        });
        return s;
    };

    const currStats = useMemo(() => buildStats(currentTxns), [currentTxns]);
    const prevStats = useMemo(() => buildStats(prevTxns),    [prevTxns]);

    const totalExpenses = useMemo(() =>
        Object.values(currStats).reduce((s, v) => s + v.amount, 0), [currStats]);

    const sortedCategories = useMemo(() =>
        Object.entries(currStats).sort((a, b) => b[1].amount - a[1].amount),
    [currStats]);

    // 6-month bar chart data for selected category
    const historyData = useMemo(() => {
        if (!selectedCategory) return [];
        return Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(selectedMonth, 5 - i);
            const amount = getMonthTxns(d)
                .filter(t => t.type === 'הוצאה' && (t.category || 'כללי') === selectedCategory)
                .reduce((s, t) => s + t.amount, 0);
            return { month: format(d, 'MMM yy', { locale: he }), amount };
        });
    }, [transactions, selectedMonth, selectedCategory]);

    // Transactions for selected category in selected month
    const categoryTxns = useMemo(() => {
        if (!selectedCategory) return [];
        return currentTxns
            .filter(t => t.type === 'הוצאה' && (t.category || 'כללי') === selectedCategory)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [currentTxns, selectedCategory]);

    const currAmt = selectedCategory ? (currStats[selectedCategory]?.amount || 0) : 0;
    const prevAmt = selectedCategory ? (prevStats[selectedCategory]?.amount || 0) : 0;
    const pctChange = prevAmt === 0 ? null : ((currAmt - prevAmt) / prevAmt * 100);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-20" dir="rtl">

            {/* ── Page header ── */}
            <div className="bg-white border-b border-slate-100 px-6 py-5 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-slate-900">פירוט לפי קטגוריה</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            סה"כ הוצאות: <span className="font-bold text-slate-800">{formatCurrency(totalExpenses)}</span>
                        </p>
                    </div>
                    {/* Month nav */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setSelectedMonth(d => subMonths(d, 1)); setSelectedCategory(null); }}
                            className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                        >
                            <ChevronRight className="h-5 w-5 text-slate-600" />
                        </button>
                        <span className="text-base font-bold text-slate-800 min-w-[130px] text-center">
                            {format(selectedMonth, 'MMMM yyyy', { locale: he })}
                        </span>
                        <button
                            onClick={() => { setSelectedMonth(d => addMonths(d, 1)); setSelectedCategory(null); }}
                            className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5 text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <div className="flex gap-6 items-start">

                    {/* ── Category list ── */}
                    <div className={`space-y-3 transition-all duration-300 ${selectedCategory ? 'w-80 flex-shrink-0' : 'w-full'}`}>
                        {sortedCategories.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl shadow-sm">
                                <Tag className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                                <p className="text-slate-500 font-medium">אין הוצאות לחודש זה</p>
                                <p className="text-slate-400 text-sm mt-1">נסה לבחור חודש אחר</p>
                            </div>
                        ) : (
                            sortedCategories.map(([cat, data], idx) => {
                                const prev = prevStats[cat]?.amount || 0;
                                const pct = totalExpenses > 0 ? (data.amount / totalExpenses * 100) : 0;
                                const change = prev === 0 ? null : ((data.amount - prev) / prev * 100);
                                const isSelected = selectedCategory === cat;
                                const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

                                return (
                                    <div
                                        key={cat}
                                        onClick={() => setSelectedCategory(isSelected ? null : cat)}
                                        className={`bg-white rounded-2xl p-4 cursor-pointer border-2 transition-all duration-200 ${
                                            isSelected
                                                ? 'border-blue-500 shadow-lg shadow-blue-100/50'
                                                : 'border-transparent shadow-sm hover:shadow-md hover:border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                <span className="font-bold text-slate-800">{cat}</span>
                                                <span className="text-xs text-slate-400">{data.count} עסקאות</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {change !== null && (
                                                    <span className={`text-xs font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                                                        change > 0
                                                            ? 'bg-red-50 text-red-500'
                                                            : 'bg-emerald-50 text-emerald-600'
                                                    }`}>
                                                        {change > 0
                                                            ? <ArrowUpRight className="h-3 w-3" />
                                                            : <ArrowDownRight className="h-3 w-3" />}
                                                        {Math.abs(change).toFixed(0)}%
                                                    </span>
                                                )}
                                                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(data.amount)}</span>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, backgroundColor: color }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-1.5">
                                            <span className="text-xs text-slate-400">{pct.toFixed(1)}% מסך ההוצאות</span>
                                            {prev > 0 && (
                                                <span className="text-xs text-slate-400">חודש שעבר: {formatCurrency(prev)}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* ── Detail panel ── */}
                    {selectedCategory && (
                        <div className="flex-1 space-y-4 min-w-0">
                            {/* Header card */}
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 rounded-2xl p-5 text-white">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-white/50 text-sm mb-1">
                                            {format(selectedMonth, 'MMMM yyyy', { locale: he })}
                                        </p>
                                        <h2 className="text-xl font-bold">{selectedCategory}</h2>
                                        <p className="text-[2rem] font-extrabold tracking-tight leading-tight mt-1">
                                            {formatCurrency(currAmt)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <button
                                            onClick={() => setSelectedCategory(null)}
                                            className="h-8 w-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                        {pctChange !== null && (
                                            <span className={`text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-full ${
                                                pctChange > 0 ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                                            }`}>
                                                {pctChange > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                                {Math.abs(pctChange).toFixed(0)}% לעומת חודש שעבר
                                            </span>
                                        )}
                                        {prevAmt > 0 && (
                                            <p className="text-white/40 text-xs">חודש שעבר: {formatCurrency(prevAmt)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 6-month bar chart */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm">
                                <h3 className="font-bold text-slate-700 mb-4 text-sm">היסטוריה — 6 חודשים אחרונים</h3>
                                <ResponsiveContainer width="100%" height={170}>
                                    <BarChart data={historyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '' : `₪${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            formatter={(v) => [formatCurrency(v), selectedCategory]}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '13px' }}
                                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                        />
                                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                            {historyData.map((_, i) => (
                                                <Cell key={i} fill={i === 5 ? '#3b82f6' : '#e2e8f0'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Transactions list */}
                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-700 text-sm">עסקאות ({categoryTxns.length})</h3>
                                    <span className="text-xs text-slate-400">{format(selectedMonth, 'MMMM', { locale: he })}</span>
                                </div>
                                {categoryTxns.length === 0 ? (
                                    <p className="text-center text-slate-400 py-10 text-sm">אין עסקאות לחודש זה</p>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {categoryTxns.map((t, i) => (
                                            <div key={i} className="flex items-center gap-3.5 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex flex-col items-center justify-center shrink-0">
                                                    <span className="text-sm font-bold text-slate-700 leading-none">{format(new Date(t.date), 'dd')}</span>
                                                    <span className="text-[9px] text-slate-400 uppercase mt-0.5">{format(new Date(t.date), 'MMM', { locale: he })}</span>
                                                </div>
                                                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{t.description}</span>
                                                <span className="font-bold text-slate-900 tabular-nums shrink-0">{formatCurrency(t.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
