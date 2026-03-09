import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, Line,
} from 'recharts';
import {
  AlertCircle, TrendingDown, Lightbulb, Loader2, Zap,
  CalendarRange, Sun, TrendingUp, Sparkles, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/Button';

const PALETTE = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

// ── Range Selector ──────────────────────────────────────────────────────────────
const RANGES = [
  { value: 'month',   label: 'חודש'     },
  { value: '3months', label: '3 חודשים' },
  { value: 'year',    label: 'שנה'      },
];

function RangeSelector({ value, onChange }) {
  return (
    <div className="flex gap-1.5 bg-slate-100/70 p-1 rounded-xl">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            value === r.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ── Custom Tooltips ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-100 shadow-2xl rounded-2xl px-4 py-3 text-right" dir="rtl">
      <p className="text-[11px] font-semibold text-slate-400 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500 text-xs">{p.name}:</span>
          <span className="font-bold text-slate-900">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Summary Stat Card ───────────────────────────────────────────────────────────
const SummaryCard = ({ label, value, sub, gradient, icon: Icon }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 shadow-lg ${gradient}`}>
    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">{label}</span>
        {Icon && <div className="h-7 w-7 rounded-xl bg-white/20 flex items-center justify-center"><Icon className="h-3.5 w-3.5 text-white" /></div>}
      </div>
      <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{value}</div>
      {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────────────
export default function SmartAnalyticsDashboard() {
  const [dateRange, setDateRange]             = useState('3months');
  const [autoCategorizingCount, setAutoCount] = useState(0);

  const { data: seasonalData } = useQuery({
    queryKey: ['seasonal'],
    queryFn: async () => {
      const res = await api.get('/analytics/seasonal');
      return res.data.data;
    },
  });

  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const endDate   = new Date();
      const startDate = new Date();
      if (dateRange === 'month')   startDate.setMonth(startDate.getMonth() - 1);
      if (dateRange === '3months') startDate.setMonth(startDate.getMonth() - 3);
      if (dateRange === 'year')    startDate.setFullYear(startDate.getFullYear() - 1);
      const res = await api.get('/analytics/smart-analytics', {
        params: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      });
      return res.data.data;
    },
  });

  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await api.get('/analytics/recommendations');
      return res.data.data;
    },
  });

  const handleAutoCategories = useCallback(async () => {
    try {
      setAutoCount(1);
      const res = await api.post('/analytics/auto-categorize', {}, { params: { limit: 100 } });
      const { categorized = [], skipped = [] } = res.data.data || {};
      toast.success(`${categorized.length} עסקאות סווגו אוטומטית (${skipped.length} דרשו סקירה ידנית)`);
      setAutoCount(0);
      refetchAnalytics();
    } catch {
      toast.error('שגיאה בסיווג אוטומטי');
      setAutoCount(0);
    }
  }, [refetchAnalytics]);

  if (analyticsLoading || recommendationsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-slate-400 text-sm">טוען דוחות חכמים...</p>
      </div>
    );
  }

  const analytics       = analyticsData || {};
  const recommendations = recommendationsData?.recommendations || [];
  const efficiency      = Math.round(analytics.efficiency?.efficiency || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-3 sm:p-6 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">דוחות חכמים</h1>
            <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              ניתוח מתקדם של תבנית ההוצאות שלך
            </p>
          </div>
          <RangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="הכנסה כוללת" icon={TrendingUp}
            value={formatCurrency(analytics.summary?.totalIncome)}
            sub="בתקופה הנבחרת"
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <SummaryCard
            label="הוצאות כוללות" icon={AlertCircle}
            value={formatCurrency(analytics.summary?.totalExpense)}
            sub={`${analytics.summary?.expenseRatio || 0}% מהכנסות`}
            gradient="bg-gradient-to-br from-rose-500 to-red-600"
          />
          <SummaryCard
            label="תזרים נטו" icon={TrendingDown}
            value={formatCurrency(analytics.summary?.netFlow)}
            sub="הכנסה פחות הוצאות"
            gradient={(analytics.summary?.netFlow ?? 0) >= 0
              ? "bg-gradient-to-br from-blue-500 to-indigo-600"
              : "bg-gradient-to-br from-orange-500 to-red-500"
            }
          />
          <SummaryCard
            label="ממוצע עסקה" icon={Sparkles}
            value={formatCurrency(analytics.summary?.avgTransaction)}
            sub={`${analytics.summary?.transactionCount || 0} עסקאות`}
            gradient="bg-gradient-to-br from-violet-600 to-purple-700"
          />
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────────── */}
        <Tabs defaultValue="trends">
          <TabsList className="w-full grid grid-cols-5 bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm rounded-2xl p-1 gap-1">
            {[
              { value: 'trends',      label: 'מגמות'     },
              { value: 'categories',  label: 'קטגוריות'  },
              { value: 'predictions', label: 'תחזיות'    },
              { value: 'patterns',    label: 'דפוסים'    },
              { value: 'seasonal',    label: 'עונתי'     },
            ].map(t => (
              <TabsTrigger
                key={t.value} value={t.value}
                className="rounded-xl text-xs font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Trends */}
          <TabsContent value="trends" className="mt-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
              <h3 className="font-bold text-slate-900 mb-1">מגמות הכנסה והוצאות</h3>
              <p className="text-slate-400 text-sm mb-6">השוואה חודשית לפי תקופה נבחרת</p>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={analytics.trends || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                  <Bar dataKey="income"  fill="#10b981" name="הכנסות" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="expense" fill="#ef4444" name="הוצאות" radius={[4,4,0,0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2.5} name="נטו" dot={false} activeDot={{ r: 4, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
                <h3 className="font-bold text-slate-900 mb-6">פילוח לפי קטגוריה</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={analytics.topCategories || []}
                      dataKey="total" nameKey="category"
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={100}
                      paddingAngle={3}
                    >
                      {(analytics.topCategories || []).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
                <h3 className="font-bold text-slate-900 mb-6">קטגוריות מובילות</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.topCategories?.slice(0, 8) || []} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="catGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" width={72} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="total" fill="url(#catGrad)" radius={[0,6,6,0]} name="סכום" maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Predictions */}
          <TabsContent value="predictions" className="mt-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-1">
                <CalendarRange className="h-5 w-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900">תחזיות הוצאות</h3>
              </div>
              <p className="text-slate-400 text-sm mb-6">מגמת הוצאות כבסיס לתחזית קדימה</p>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={analytics.trends || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                  <Area type="monotone" dataKey="expense" fill="url(#predGrad)" stroke="#ef4444" strokeWidth={2} name="הוצאות" dot={false} />
                  <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2.5} name="נטו" dot={false} activeDot={{ r: 4, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Patterns */}
          <TabsContent value="patterns" className="mt-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
              <h3 className="font-bold text-slate-900 mb-6">דפוסים וחריגויות</h3>
              <div className="space-y-3">
                {(analytics.patterns || []).map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100/60">
                    <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">
                        {p.type === 'day_of_week' ? `יום הפעיל ביותר: ${p.mostCommon}` : p.type}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.frequency} עסקאות</p>
                    </div>
                  </div>
                ))}

                {(analytics.anomalies || []).length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <h4 className="font-bold text-red-600 text-sm">חריגויות שזוהו</h4>
                    </div>
                    {analytics.anomalies.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 bg-red-50/60 rounded-2xl border border-red-100/60">
                        <div className="h-8 w-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{a.description}</p>
                          <p className="text-sm font-bold text-red-600 mt-0.5">{formatCurrency(a.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {!(analytics.patterns?.length) && !(analytics.anomalies?.length) && (
                  <p className="text-center text-slate-300 py-10 text-sm">אין מספיק נתונים לזיהוי דפוסים</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Seasonal */}
          <TabsContent value="seasonal" className="mt-4 space-y-4">
            {!seasonalData ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-12 text-center">
                <Sun className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">אין מספיק נתונים לניתוח עונתי</p>
              </div>
            ) : (
              <>
                {seasonalData.insights?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {seasonalData.insights.map((ins, i) => (
                      <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl border ${
                        ins.priority === 'high'   ? 'border-red-100   bg-red-50/60'   :
                        ins.priority === 'medium' ? 'border-amber-100 bg-amber-50/60' :
                                                    'border-blue-100  bg-blue-50/60'
                      }`}>
                        <span className="text-xl flex-shrink-0">{ins.icon}</span>
                        <p className="text-sm text-slate-700 leading-relaxed">{ins.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Sun className="h-5 w-5 text-amber-500" />
                    <h3 className="font-bold text-slate-900">ממוצע הוצאות חודשי</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-6">כמה מוצא החודש הזה בממוצע בכל שנה</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={seasonalData.monthly || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="seasonGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={6} />
                      <YAxis tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="avg" fill="url(#seasonGrad)" radius={[6,6,0,0]} name="ממוצע" maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
                  <h3 className="font-bold text-slate-900 mb-5">ממוצע לפי רבעון</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(seasonalData.quarterly || []).map((q, i) => {
                      const gradients = [
                        'from-blue-500 to-indigo-600',
                        'from-emerald-500 to-teal-500',
                        'from-amber-400 to-orange-500',
                        'from-violet-500 to-purple-600',
                      ];
                      return (
                        <div key={i} className={`p-4 rounded-2xl text-center bg-gradient-to-br ${gradients[i]} shadow-sm`}>
                          <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-2">{q.label}</p>
                          <p className="text-xl font-extrabold text-white">{formatCurrency(q.avg)}</p>
                          <p className="text-white/60 text-[10px] mt-1">ממוצע שנתי</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Recommendations + Efficiency ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recommendations */}
          <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">המלצות חכמות</h3>
                <p className="text-xs text-slate-400">מבוסס על ניתוח דפוסי ההוצאות שלך</p>
              </div>
            </div>
            {recommendations.length === 0 ? (
              <p className="text-center text-slate-300 py-8 text-sm">אין המלצות כרגע</p>
            ) : (
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((rec, i) => (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl border ${
                    rec.priority === 'high'   ? 'bg-red-50/70    border-red-100'    :
                    rec.priority === 'medium' ? 'bg-amber-50/70  border-amber-100'  :
                                               'bg-blue-50/70   border-blue-100'
                  }`}>
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      rec.priority === 'high'   ? 'bg-red-100'    :
                      rec.priority === 'medium' ? 'bg-amber-100'  : 'bg-blue-100'
                    }`}>
                      <AlertCircle className={`h-4 w-4 ${
                        rec.priority === 'high' ? 'text-red-500' : rec.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm leading-relaxed">{rec.suggestion}</p>
                      {rec.type === 'high_frequency' && (
                        <p className="text-xs text-slate-500 mt-1">הופיע {rec.frequency} פעמים</p>
                      )}
                      {rec.type === 'savings_opportunity' && (
                        <p className="text-xs text-emerald-600 font-semibold mt-1">
                          חיסכון פוטנציאלי: {formatCurrency(rec.potentialSavings)}/שנה
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Efficiency */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/60 shadow-lg p-6 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <TrendingDown className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-slate-500 text-sm font-semibold mb-4">דירוג יעילות</p>

            {/* Efficiency ring */}
            <div className="relative w-32 h-32 mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={efficiency >= 70 ? '#10b981' : efficiency >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - efficiency / 100)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1.2s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-extrabold ${efficiency >= 70 ? 'text-emerald-600' : efficiency >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                  {efficiency}
                </span>
                <span className="text-slate-400 text-xs">%</span>
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-700 mb-1">
              {efficiency >= 70 ? '✅ מעולה!' : efficiency >= 40 ? '⚠️ יש מקום לשיפור' : '📉 דורש תשומת לב'}
            </p>

            <div className="w-full space-y-2 mt-4 text-xs">
              <div className="flex justify-between text-slate-500 bg-slate-50 rounded-xl p-2.5">
                <span>הכנסה</span>
                <span className="font-bold text-emerald-600">{formatCurrency(analytics.summary?.totalIncome)}</span>
              </div>
              <div className="flex justify-between text-slate-500 bg-slate-50 rounded-xl p-2.5">
                <span>הוצאות</span>
                <span className="font-bold text-red-500">{formatCurrency(analytics.summary?.totalExpense)}</span>
              </div>
              <div className="flex justify-between text-slate-500 bg-slate-50 rounded-xl p-2.5">
                <span>לחיסכון</span>
                <span className={`font-bold ${(analytics.summary?.netFlow ?? 0) >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {formatCurrency(analytics.summary?.netFlow)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleAutoCategories}
              disabled={autoCategorizingCount > 0}
              className="w-full mt-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 border-0 text-white rounded-xl shadow-md shadow-indigo-200/50 transition-all"
            >
              <Zap className="me-2 h-4 w-4" />
              {autoCategorizingCount > 0 ? 'סיווג בתהליך...' : 'סווג עסקאות אוטומטית'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
