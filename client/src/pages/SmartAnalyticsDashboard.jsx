import React, { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Lightbulb, Zap } from 'lucide-react';
import api from '@/utils/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function SmartAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState('3months');
  const [autoCategorizingCount, setAutoCategorizingCount] = useState(0);

  // Fetch analytics
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();

      if (dateRange === 'month') startDate.setMonth(startDate.getMonth() - 1);
      else if (dateRange === '3months') startDate.setMonth(startDate.getMonth() - 3);
      else if (dateRange === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

      const response = await api.get('/analytics/smart-analytics', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
      return response.data.data;
    },
  });

  // Fetch recommendations
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const response = await api.get('/analytics/recommendations');
      return response.data.data;
    },
  });

  // Fetch predictions
  const { data: predictionsData, isLoading: predictionsLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: async () => {
      const response = await api.get('/analytics/predictions', {
        params: { months: 3 },
      });
      return response.data.data;
    },
  });

  // Auto-categorize transactions
  const handleAutoCategories = useCallback(async () => {
    try {
      setAutoCategorizingCount(1);
      const response = await api.post('/analytics/auto-categorize', {}, {
        params: { limit: 100 },
      });

      toast.success(`✅ ${response.data.data.categorized.length} עסקאות סווגו אוטומטית`, {
        description: `${response.data.data.skipped.length} עסקאות דרשו סקירה ידנית`,
      });

      setAutoCategorizingCount(0);
      refetchAnalytics();
    } catch (error) {
      toast.error('שגיאה בסיווג אוטומטי');
      setAutoCategorizingCount(0);
    }
  }, [refetchAnalytics]);

  if (analyticsLoading || recommendationsLoading || predictionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Zap className="w-12 h-12 animate-spin mx-auto mb-2 text-blue-500" />
          <p>טוען דוחות חכמים...</p>
        </div>
      </div>
    );
  }

  const analytics = analyticsData || {};
  const recommendations = recommendationsData?.recommendations || [];
  const predictions = predictionsData?.predictions || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🧠 דוחות חכמים
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            ניתוח מתקדם של תבנית ההוצאות שלך עם תחזוקות מבוססות AI
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="hover:shadow-lg transition">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">הכנסה כוללת</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                ₪{analytics.summary?.totalIncome?.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">בתקופה הנבחרת</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">הוצאות כוללות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                ₪{analytics.summary?.totalExpense?.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.summary?.expenseRatio}% מהכנסות
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">זרימת נטו</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${
                analytics.summary?.netFlow >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ₪{analytics.summary?.netFlow?.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">הכנסה - הוצאות</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">ממוצע עסקה</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                ₪{analytics.summary?.avgTransaction?.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.summary?.transactionCount} עסקאות
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts */}
        <Tabs defaultValue="trends" className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trends">מגמות</TabsTrigger>
            <TabsTrigger value="categories">קטגוריות</TabsTrigger>
            <TabsTrigger value="predictions">תחזוקות</TabsTrigger>
            <TabsTrigger value="patterns">דפוסים</TabsTrigger>
          </TabsList>

          {/* Trends Tab */}
          <TabsContent value="trends" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>מגמות הכנסה והוצאות</CardTitle>
                <CardDescription>
                  <div className="flex gap-4 mt-2">
                    <button
                      onClick={() => setDateRange('month')}
                      className={`px-3 py-1 rounded text-sm ${dateRange === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    >
                      חודש
                    </button>
                    <button
                      onClick={() => setDateRange('3months')}
                      className={`px-3 py-1 rounded text-sm ${dateRange === '3months' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    >
                      3 חודשים
                    </button>
                    <button
                      onClick={() => setDateRange('year')}
                      className={`px-3 py-1 rounded text-sm ${dateRange === 'year' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    >
                      שנה
                    </button>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={analytics.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" />
                    <Bar dataKey="expense" fill="#ef4444" />
                    <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>קטגוריות (עוגה)</CardTitle>
                </CardHeader>
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
                        label
                      >
                        {(analytics.topCategories || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>קטגוריות גדולות</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topCategories?.slice(0, 8) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
                      <Bar dataKey="total" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Predictions Tab */}
          <TabsContent value="predictions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>תחזוקות הוצאות</CardTitle>
                <CardDescription>תחזוקה של 3 חודשים לפי קטגוריה</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={analyticsData?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
                    <Legend />
                    <Area type="monotone" dataKey="expense" fill="#fee2e2" stroke="#ef4444" />
                    <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>דפוסים וחריגויות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.patterns?.map((pattern, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                        {pattern.type === 'day_of_week' && `📅 יום הפעיל ביותר: ${pattern.mostCommon}`}
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {pattern.frequency} עסקאות
                      </p>
                    </div>
                  ))}

                  {analytics.anomalies?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 text-red-600 dark:text-red-400">🚨 חריגויות</h3>
                      {analytics.anomalies.map((anomaly, idx) => (
                        <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/20 rounded mb-2">
                          <p className="text-sm">
                            <span className="font-semibold">{anomaly.description}</span>
                            {' - '}
                            <span className="text-red-600 dark:text-red-400 font-bold">₪{anomaly.amount}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recommendations Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                המלצות חכמות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((rec, idx) => (
                  <Alert key={idx} className={
                    rec.priority === 'high'
                      ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                      : rec.priority === 'medium'
                      ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                  }>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold">{rec.suggestion}</p>
                      {rec.type === 'high_frequency' && (
                        <p className="text-xs mt-1">הופיע {rec.frequency} פעמים</p>
                      )}
                      {rec.type === 'savings_opportunity' && (
                        <p className="text-xs mt-1">
                          🎯 חיסכון פוטנציאלי: ₪{rec.potentialSavings}/שנה
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-green-500" />
                דירוג יעילות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-5xl font-bold text-green-600 mb-2">
                  {Math.round(analytics.efficiency?.efficiency || 0)}%
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {analytics.efficiency?.efficiency >= 70 ? '✅ מעולה!' : '⚠️ יש מקום לשיפור'}
                </p>

                <Button
                  onClick={handleAutoCategories}
                  disabled={autoCategorizingCount > 0}
                  className="w-full"
                >
                  {autoCategorizingCount > 0 ? 'סיווג בתהליך...' : '⚡ סווג עסקאות אוטומטית'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Efficiency Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>פירוט יעילות הוצאות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-900/10 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  ₪{analytics.summary?.totalIncome?.toLocaleString()}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">הכנסה</p>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/20 dark:to-red-900/10 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  ₪{analytics.summary?.totalExpense?.toLocaleString()}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">הוצאות</p>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  ₪{analytics.summary?.netFlow?.toLocaleString()}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">זמין לחיסכון</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
