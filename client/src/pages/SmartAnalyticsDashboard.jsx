import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, Line,
} from 'recharts';
import {
  AlertCircle, TrendingDown, Lightbulb,
  Loader2, Zap, CalendarRange,
} from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// ---------------------------------------------------------------------------
// Date-range buttons
// ---------------------------------------------------------------------------
const RANGES = [
  { value: 'month',   label: 'חודש'     },
  { value: '3months', label: '3 חודשים' },
  { value: 'year',    label: 'שנה'      },
];

function RangeSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {RANGES.map((r) => (
        <Button
          key={r.value}
          size="sm"
          variant={value === r.value ? 'default' : 'outline'}
          onClick={() => onChange(r.value)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SmartAnalyticsDashboard() {
  const [dateRange, setDateRange]               = useState('3months');
  const [autoCategorizingCount, setAutoCount]   = useState(0);

  // --- Analytics ---
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

  // --- Recommendations ---
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await api.get('/analytics/recommendations');
      return res.data.data;
    },
  });

  // --- Auto-categorize ---
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
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        <p className="text-gray-500 dark:text-slate-400">טוען דוחות חכמים...</p>
      </div>
    );
  }

  const analytics       = analyticsData || {};
  const recommendations = recommendationsData?.recommendations || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              דוחות חכמים
            </h1>
            <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              ניתוח מתקדם של תבנית ההוצאות שלך עם תחזיות מבוססות AI
            </p>
          </div>
          <RangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="hover:shadow-lg transition dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">הכנסה כוללת</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-3xl font-bold text-green-600">
                {formatCurrency(analytics.summary?.totalIncome)}
              </div>
              <p className="text-xs text-gray-500 mt-1">בתקופה הנבחרת</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">הוצאות כוללות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-3xl font-bold text-red-600">
                {formatCurrency(analytics.summary?.totalExpense)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.summary?.expenseRatio}% מהכנסות
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">תזרים נטו</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl sm:text-3xl font-bold ${(analytics.summary?.netFlow ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(analytics.summary?.netFlow)}
              </div>
              <p className="text-xs text-gray-500 mt-1">הכנסה פחות הוצאות</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ממוצע עסקה</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-3xl font-bold text-blue-600">
                {formatCurrency(analytics.summary?.avgTransaction)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.summary?.transactionCount} עסקאות
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="trends" className="mb-6 sm:mb-8">
          <TabsList className="grid w-full grid-cols-4 text-xs sm:text-sm">
            <TabsTrigger value="trends">מגמות</TabsTrigger>
            <TabsTrigger value="categories">קטגוריות</TabsTrigger>
            <TabsTrigger value="predictions">תחזיות</TabsTrigger>
            <TabsTrigger value="patterns">דפוסים</TabsTrigger>
          </TabsList>

          {/* Trends */}
          <TabsContent value="trends" className="mt-4">
            <Card className="dark:bg-slate-900">
              <CardHeader>
                <CardTitle>מגמות הכנסה והוצאות</CardTitle>
                <CardDescription>השוואה חודשית לפי תקופה נבחרת</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={analytics.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar  dataKey="income"  fill="#10b981" name="הכנסות" />
                    <Bar  dataKey="expense" fill="#ef4444" name="הוצאות" />
                    <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} name="נטו" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="dark:bg-slate-900">
                <CardHeader><CardTitle>פילוח לפי קטגוריה</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.topCategories || []}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      >
                        {(analytics.topCategories || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="dark:bg-slate-900">
                <CardHeader><CardTitle>קטגוריות מובילות</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topCategories?.slice(0, 8) || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Bar dataKey="total" fill="#3b82f6" name="סכום" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Predictions */}
          <TabsContent value="predictions" className="mt-4">
            <Card className="dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-blue-500" />
                  תחזיות הוצאות
                </CardTitle>
                <CardDescription>מגמת הוצאות והכנסות כבסיס לתחזית קדימה</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={analytics.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="expense" fill="#fee2e2" stroke="#ef4444" name="הוצאות" />
                    <Line type="monotone" dataKey="net"     stroke="#3b82f6" strokeWidth={2} name="נטו" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patterns */}
          <TabsContent value="patterns" className="mt-4">
            <Card className="dark:bg-slate-900">
              <CardHeader><CardTitle>דפוסים וחריגויות</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(analytics.patterns || []).map((p, i) => (
                    <div key={i} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                        {p.type === 'day_of_week' ? `יום הפעיל ביותר: ${p.mostCommon}` : p.type}
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{p.frequency} עסקאות</p>
                    </div>
                  ))}

                  {(analytics.anomalies || []).length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 text-red-600 dark:text-red-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        חריגויות שזוהו
                      </h3>
                      {analytics.anomalies.map((a, i) => (
                        <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-2">
                          <p className="text-sm">
                            <span className="font-semibold">{a.description}</span>
                            {' — '}
                            <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(a.amount)}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!(analytics.patterns?.length) && !(analytics.anomalies?.length) && (
                    <p className="text-center text-gray-400 dark:text-slate-500 py-8">אין מספיק נתונים לזיהוי דפוסים</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recommendations + Efficiency */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="lg:col-span-2 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                המלצות חכמות
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-slate-500 py-6">אין המלצות כרגע</p>
              ) : (
                <div className="space-y-3">
                  {recommendations.slice(0, 5).map((rec, i) => (
                    <Alert key={i} className={
                      rec.priority === 'high'   ? 'border-red-300    bg-red-50    dark:bg-red-900/20'    :
                      rec.priority === 'medium' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20' :
                                                  'border-blue-300   bg-blue-50   dark:bg-blue-900/20'
                    }>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-semibold">{rec.suggestion}</p>
                        {rec.type === 'high_frequency' && (
                          <p className="text-xs mt-1">הופיע {rec.frequency} פעמים</p>
                        )}
                        {rec.type === 'savings_opportunity' && (
                          <p className="text-xs mt-1">חיסכון פוטנציאלי: {formatCurrency(rec.potentialSavings)}/שנה</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-green-500" />
                דירוג יעילות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-6xl font-bold text-green-600 mb-1">
                  {Math.round(analytics.efficiency?.efficiency || 0)}
                  <span className="text-3xl">%</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {(analytics.efficiency?.efficiency || 0) >= 70 ? '✅ מעולה!' : '⚠️ יש מקום לשיפור'}
                </p>
                <Button onClick={handleAutoCategories} disabled={autoCategorizingCount > 0} className="w-full">
                  <Zap className="me-2 h-4 w-4" />
                  {autoCategorizingCount > 0 ? 'סיווג בתהליך...' : 'סווג עסקאות אוטומטית'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Efficiency breakdown */}
        <Card className="dark:bg-slate-900">
          <CardHeader><CardTitle>פירוט יעילות הוצאות</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { value: analytics.summary?.totalIncome,  label: 'הכנסה',          color: 'green' },
                { value: analytics.summary?.totalExpense, label: 'הוצאות',         color: 'red'   },
                { value: analytics.summary?.netFlow,      label: 'זמין לחיסכון',  color: 'blue'  },
              ].map(({ value, label, color }) => (
                <div key={label} className={`text-center p-4 bg-gradient-to-br from-${color}-100 to-${color}-50 dark:from-${color}-900/20 dark:to-${color}-900/10 rounded-lg`}>
                  <p className={`text-2xl font-bold text-${color}-600`}>{formatCurrency(value)}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
