import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1','#14b8a6','#a855f7'];
const MONTHS_HEB = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];

export default function ReportsPage() {
  const [tab, setTab] = useState('yearly');
  const [yearly, setYearly] = useState(null);
  const [trends, setTrends] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendMonths, setTrendMonths] = useState('6');

  const load = async () => {
    setLoading(true);
    try {
      const [yRes, tRes, sRes] = await Promise.all([
        api.get('/reports/yearly-comparison').catch(() => ({ data: null })),
        api.get(`/reports/trends?months=${trendMonths}`).catch(() => ({ data: null })),
        api.get('/reports/financial-summary').catch(() => ({ data: null })),
      ]);
      setYearly(yRes.data);
      setTrends(tRes.data);
      setSummary(sRes.data);
    } catch { toast.error('שגיאה בטעינה'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [trendMonths]);

  const pctBadge = (pct) => {
    if (pct == null) return null;
    const isPos = pct >= 0;
    return (
      <Badge variant={isPos ? 'default' : 'destructive'} className="text-xs gap-1">
        {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(pct).toFixed(1)}%
      </Badge>
    );
  };

  // Derive current/previous year data from API shape { years: { 2026: {...}, 2025: {...} }, comparison }
  const currentYear = new Date().getFullYear();
  const curYearData = yearly?.years?.[currentYear];
  const prevYearData = yearly?.years?.[currentYear - 1];
  const changes = yearly?.comparison;

  // Monthly comparison chart — monthly is keyed by 1-12
  const monthlyChart = curYearData ? Array.from({ length: 12 }, (_, i) => ({
    name: MONTHS_HEB[i],
    current_income: curYearData.monthly?.[i + 1]?.income || 0,
    current_expense: curYearData.monthly?.[i + 1]?.expense || 0,
    prev_income: prevYearData?.monthly?.[i + 1]?.income || 0,
    prev_expense: prevYearData?.monthly?.[i + 1]?.expense || 0,
  })) : [];

  // Category pie
  const categoryPie = (curYearData?.byCategory || []).slice(0, 10).map(c => ({
    name: c.category, value: c.amount,
  }));

  // Trend lines — API returns { trends: [{month, label, categories: {cat: amt}}], categoryAverages }
  const trendData = trends?.trends || [];
  const allTrendCategories = [...new Set(trendData.flatMap(m => Object.keys(m.categories || {})))];
  const trendChartData = trendData.map(m => {
    const entry = { month: m.label || m.month };
    allTrendCategories.forEach(cat => { entry[cat] = m.categories?.[cat] || 0; });
    return entry;
  });
  const trendCategoryAverages = trends?.categoryAverages || {};  

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-7 w-7 text-violet-500" /> דוחות מתקדמים</h1>
        <p className="text-sm text-gray-500 mt-1">ניתוח שנתי, מגמות ותמונה פיננסית כוללת</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'yearly' ? 'default' : 'outline'} onClick={() => setTab('yearly')} className="gap-1">
          <BarChart3 className="h-4 w-4" /> השוואה שנתית
        </Button>
        <Button variant={tab === 'trends' ? 'default' : 'outline'} onClick={() => setTab('trends')} className="gap-1">
          <TrendingUp className="h-4 w-4" /> מגמות
        </Button>
        <Button variant={tab === 'summary' ? 'default' : 'outline'} onClick={() => setTab('summary')} className="gap-1">
          <PieChartIcon className="h-4 w-4" /> סיכום כולל
        </Button>
      </div>

      {/* YEARLY TAB */}
      {tab === 'yearly' && yearly && (
        <div className="space-y-6">
          {/* YoY Comparison Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">הכנסות השנה</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(curYearData?.totalIncome)}</p>
              {pctBadge(changes?.incomeChange)}
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">הוצאות השנה</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(curYearData?.totalExpense)}</p>
              {pctBadge(changes?.expenseChange)}
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">חיסכון נטו</p>
              <p className={`text-xl font-bold ${(curYearData?.totalNet || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(curYearData?.totalNet)}
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">שיעור חיסכון</p>
              <p className="text-xl font-bold text-blue-600">{formatPercent(curYearData?.savingsRate)}</p>
              {pctBadge(changes?.savingsRateChange)}
            </CardContent></Card>
          </div>

          {/* Monthly Comparison Chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm">השוואה חודשית — שנה נוכחית מול קודמת</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="current_income" name="הכנסה - השנה" fill="#10b981" radius={[2,2,0,0]} />
                  <Bar dataKey="current_expense" name="הוצאה - השנה" fill="#ef4444" radius={[2,2,0,0]} />
                  <Bar dataKey="prev_income" name="הכנסה - שנה קודמת" fill="#86efac" radius={[2,2,0,0]} />
                  <Bar dataKey="prev_expense" name="הוצאה - שנה קודמת" fill="#fca5a5" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category breakdown */}
          {categoryPie.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">הוצאות לפי קטגוריה</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={categoryPie} cx="50%" cy="50%" innerRadius={40} outerRadius={90} dataKey="value">
                        {categoryPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => formatCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">טופ 10 קטגוריות</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(curYearData?.byCategory || []).slice(0, 10).map((c, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm">{c.category}</span>
                        </div>
                        <span className="font-bold text-sm">{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TRENDS TAB */}
      {tab === 'trends' && (
        <div className="space-y-6">
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium">תקופה:</span>
            <Select value={trendMonths} onValueChange={setTrendMonths}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 חודשים</SelectItem>
                <SelectItem value="6">6 חודשים</SelectItem>
                <SelectItem value="12">12 חודשים</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trendChartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">מגמת הוצאות לפי קטגוריה</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={10} />
                    <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Legend />
                    {allTrendCategories.slice(0, 8).map((cat, i) => (
                      <Area key={cat} type="monotone" dataKey={cat} stackId="1" fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.4} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Trend Table */}
          {Object.keys(trendCategoryAverages).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">ממוצע מול חודש אחרון</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(trendCategoryAverages).map(([cat, stats], i) => {
                    const diff = stats.vsAverage || 0;
                    return (
                      <div key={i} className="flex justify-between items-center border-b pb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm">{cat}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">ממוצע: {formatCurrency(stats.average)}</span>
                          <span className="text-sm font-bold">{formatCurrency(stats.current)}</span>
                          {diff !== 0 && (
                            <Badge variant={diff > 10 ? 'destructive' : diff < -10 ? 'default' : 'secondary'} className="text-xs">
                              {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SUMMARY TAB */}
      {tab === 'summary' && summary && (
        <div className="space-y-6">
          {/* Net Worth Summary */}
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-emerald-950 border-emerald-200">
            <CardHeader><CardTitle className="text-lg">שווי נקי</CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-center text-emerald-600">{formatCurrency(summary.netWorth?.netWorth)}</p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">נכסים</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(summary.netWorth?.totalAssets)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">התחייבויות</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(summary.netWorth?.totalLiabilities)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Module Summaries Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.accounts && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">חשבונות</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">יתרה כוללת</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.accounts.totalBalance)}</p>
                  <p className="text-xs text-gray-400">{summary.accounts.count} חשבונות</p>
                </CardContent>
              </Card>
            )}
            {summary.deposits && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">פיקדונות</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">סך הכל</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.deposits.totalAmount)}</p>
                  <p className="text-xs text-gray-400">{summary.deposits.count} פיקדונות</p>
                </CardContent>
              </Card>
            )}
            {summary.stocks && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">מניות</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">שווי שוק</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.stocks.totalValue)}</p>
                  <p className="text-xs text-gray-400">{summary.stocks.count} מניות</p>
                </CardContent>
              </Card>
            )}
            {summary.pension && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">פנסיה</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">צבירה</p>
                  <p className="text-lg font-bold">{formatCurrency(summary.pension.totalAccumulated)}</p>
                  <p className="text-xs text-gray-400">{summary.pension.count} קופות</p>
                </CardContent>
              </Card>
            )}
            {summary.loans && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">הלוואות</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">יתרה</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(summary.loans.totalRemaining)}</p>
                  <p className="text-xs text-gray-400">{summary.loans.count} הלוואות</p>
                </CardContent>
              </Card>
            )}
            {summary.insurance && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">ביטוח</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">עלות חודשית</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(summary.insurance.monthlyCost)}</p>
                  <p className="text-xs text-gray-400">{summary.insurance.count} פוליסות</p>
                </CardContent>
              </Card>
            )}
            {summary.realEstate && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">נדל"ן</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">שווי</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.realEstate.totalValue)}</p>
                  <p className="text-xs text-gray-400">{summary.realEstate.count} נכסים</p>
                </CardContent>
              </Card>
            )}
            {summary.foreignCurrency && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">מט"ח</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">שווי (₪)</p>
                  <p className="text-lg font-bold text-indigo-600">{formatCurrency(summary.foreignCurrency.totalILS)}</p>
                  <p className="text-xs text-gray-400">{summary.foreignCurrency.count} אחזקות</p>
                </CardContent>
              </Card>
            )}
            {summary.childSavings && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">חיסכון ילדים</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">סה"כ</p>
                  <p className="text-lg font-bold text-pink-600">{formatCurrency(summary.childSavings.totalBalance)}</p>
                  <p className="text-xs text-gray-400">{summary.childSavings.count} חסכונות</p>
                </CardContent>
              </Card>
            )}
            {summary.goals && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">יעדים</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">הושלמו</p>
                  <p className="text-lg font-bold text-violet-600">{summary.goals.completed} / {summary.goals.total}</p>
                  <p className="text-xs text-gray-400">בדרך: {summary.goals.onTrack}</p>
                </CardContent>
              </Card>
            )}
            {summary.mortgages && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">משכנתאות</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500">יתרה</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(summary.mortgages.totalBalance)}</p>
                  <p className="text-xs text-gray-400">{summary.mortgages.count} משכנתאות</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Health Score */}
          {summary.healthScore && (
            <Card>
              <CardHeader><CardTitle className="text-sm">ציון בריאות פיננסית</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className={`text-5xl font-bold ${summary.healthScore.normalizedScore >= 70 ? 'text-green-600' : summary.healthScore.normalizedScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {summary.healthScore.normalizedScore?.toFixed(0) || summary.healthScore.score}
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full ${summary.healthScore.normalizedScore >= 70 ? 'bg-green-500' : summary.healthScore.normalizedScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(summary.healthScore.normalizedScore || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{summary.healthScore.grade}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {!yearly && !trends && !summary && (
        <Card><CardContent className="py-12 text-center text-gray-500">אין מספיק נתונים ליצירת דוחות. הוסף עסקאות ונתונים פיננסיים.</CardContent></Card>
      )}
    </div>
  );
}
