import { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, Trash2, Copy, ChevronRight, ChevronLeft, AlertTriangle,
  CheckCircle, TrendingUp, PieChart, Target, ArrowDown, ArrowUp
} from 'lucide-react';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import toast from 'react-hot-toast';

const MONTHS_HE = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
];

export default function BudgetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState(null);
  const [spending, setSpending] = useState({});
  const [uncategorized, setUncategorized] = useState({});
  const [exists, setExists] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [categories, setCategories] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  // טופס תקציב
  const [form, setForm] = useState({ totalLimit: '', alertThreshold: 80, items: [], notes: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');

  // טעינת נתונים
  useEffect(() => { fetchBudget(); fetchCategories(); }, [month, year]);

  const fetchBudget = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/budgets?month=${month}&year=${year}`);
      setBudget(data.budget);
      setSpending(data.spending || {});
      setUncategorized(data.uncategorizedSpending || {});
      setExists(data.exists);

      if (data.budget) {
        setForm({
          totalLimit: data.budget.totalLimit.toString(),
          alertThreshold: data.budget.alertThreshold,
          items: data.budget.items.map((i, idx) => ({
            category: i.category,
            limit: i.limit.toString(),
            color: i.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
          })),
          notes: data.budget.notes || '',
        });
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data.map(c => c.name));
    } catch (err) {
      // ignore - user may not have categories
    }
  };

  // ניווט חודשים
  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // הוספת קטגוריה לתקציב
  const addItem = () => {
    if (!newCategory || !newLimit) return;
    if (form.items.some(i => i.category === newCategory)) {
      toast.error('קטגוריה זו כבר קיימת בתקציב');
      return;
    }
    setForm(f => ({
      ...f,
      items: [...f.items, {
        category: newCategory,
        limit: newLimit,
        color: CATEGORY_COLORS[f.items.length % CATEGORY_COLORS.length],
      }],
    }));
    setNewCategory('');
    setNewLimit('');
  };

  const removeItem = (index) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  };

  // שמירת תקציב
  const saveBudget = async () => {
    if (!form.totalLimit || form.items.length === 0) {
      toast.error('יש להזין סכום כולל ולפחות קטגוריה אחת');
      return;
    }
    try {
      await api.post('/budgets', {
        month, year,
        totalLimit: Number(form.totalLimit),
        items: form.items.map(i => ({ category: i.category, limit: Number(i.limit), color: i.color })),
        alertThreshold: form.alertThreshold,
        notes: form.notes,
      });
      toast.success('התקציב נשמר בהצלחה');
      setShowDialog(false);
      fetchBudget();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בשמירת התקציב');
    }
  };

  // העתקת תקציב מחודש קודם
  const copyFromPrev = async () => {
    const fromMonth = month === 1 ? 12 : month - 1;
    const fromYear = month === 1 ? year - 1 : year;
    try {
      await api.post('/budgets/copy', { fromMonth, fromYear, toMonth: month, toYear: year });
      toast.success('התקציב הועתק בהצלחה');
      fetchBudget();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהעתקה');
    }
  };

  // סיכום שנתי
  const loadSummary = async () => {
    try {
      const { data } = await api.get(`/budgets/summary?year=${year}`);
      setSummaryData(data);
      setShowSummary(true);
    } catch (err) {
      toast.error('שגיאה בטעינת סיכום');
    }
  };

  // מחיקת תקציב
  const deleteBudget = async () => {
    if (!budget?._id) return;
    try {
      await api.delete(`/budgets/${budget._id}`);
      toast.success('התקציב נמחק');
      fetchBudget();
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  // חישובים
  const totalBudgeted = useMemo(() => form.items.reduce((s, i) => s + Number(i.limit || 0), 0), [form.items]);
  const totalSpent = budget?.totalSpent || 0;
  const percentUsed = budget?.totalLimit > 0 ? Math.round((totalSpent / budget.totalLimit) * 100) : 0;

  const pieData = useMemo(() => {
    if (!budget?.items) return [];
    return budget.items.map(item => ({
      name: item.category,
      planned: item.limit,
      actual: item.spent || 0,
      color: item.color,
    }));
  }, [budget]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl" dir="rtl">
      {/* כותרת + ניווט חודשים */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="h-7 w-7 text-blue-600" />
            תקציב חודשי
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            תכנן ועקוב אחרי ההוצאות שלך
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-lg font-semibold min-w-[140px] text-center text-slate-800 dark:text-white">
            {MONTHS_HE[month]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronLeft className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* אם אין תקציב */}
      {!exists ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center py-16">
          <Target className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
            אין תקציב ל{MONTHS_HE[month]} {year}
          </h2>
          <p className="text-slate-500 mb-6">הגדר תקציב חודשי כדי לנהל את ההוצאות שלך בצורה חכמה</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => { setForm({ totalLimit: '', alertThreshold: 80, items: [], notes: '' }); setShowDialog(true); }}>
              <Plus className="h-4 w-4 me-2" /> צור תקציב חדש
            </Button>
            <Button variant="outline" onClick={copyFromPrev}>
              <Copy className="h-4 w-4 me-2" /> העתק מחודש קודם
            </Button>
          </div>
        </motion.div>
      ) : (
        <>
          {/* כרטיסי סיכום */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">תקציב כולל</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(budget.totalLimit)}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">הוצאות בפועל</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</p>
                  </div>
                  <ArrowDown className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">נותר</p>
                    <p className={`text-2xl font-bold ${budget.totalLimit - totalSpent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(budget.totalLimit - totalSpent)}
                    </p>
                  </div>
                  {budget.totalLimit - totalSpent >= 0 
                    ? <CheckCircle className="h-8 w-8 text-green-500" />
                    : <AlertTriangle className="h-8 w-8 text-red-500" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">ניצול</p>
                    <p className={`text-2xl font-bold ${percentUsed > 100 ? 'text-red-600' : percentUsed > 80 ? 'text-amber-600' : 'text-green-600'}`}>
                      {percentUsed}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-amber-500" />
                </div>
                <Progress value={Math.min(percentUsed, 100)} className="mt-3" />
              </CardContent>
            </Card>
          </div>

          {/* גרף + פירוט */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* גרף עוגה */}
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-lg">התפלגות תקציב</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie data={pieData} dataKey="planned" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                  </RechartsPie>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* מתוכנן vs בפועל */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-lg">מתוכנן מול בפועל</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pieData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="planned" name="תקציב" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actual" name="בפועל" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* פירוט קטגוריות */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">פירוט לפי קטגוריות</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadSummary}>
                  <PieChart className="h-4 w-4 me-1" /> סיכום שנתי
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
                  ערוך תקציב
                </Button>
                <Button size="sm" variant="outline" className="text-red-500" onClick={deleteBudget}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {budget.items.map((item, i) => {
                  const spent = item.spent || 0;
                  const pct = item.limit > 0 ? Math.round((spent / item.limit) * 100) : 0;
                  const isOver = spent > item.limit;
                  const isNear = pct >= budget.alertThreshold && !isOver;

                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className={`p-4 rounded-lg border ${isOver ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800' : isNear ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="font-medium text-slate-800 dark:text-slate-200">{item.category}</span>
                          {isOver && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          {isNear && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          <span className={isOver ? 'text-red-600 font-bold' : ''}>{formatCurrency(spent)}</span>
                          {' / '}
                          {formatCurrency(item.limit)}
                        </div>
                      </div>
                      <Progress value={Math.min(pct, 100)} className={`h-2 ${isOver ? '[&>div]:bg-red-500' : isNear ? '[&>div]:bg-amber-500' : ''}`} />
                      <p className="text-xs text-slate-500 mt-1">{pct}% ניצול • נותר {formatCurrency(Math.max(0, item.limit - spent))}</p>
                    </motion.div>
                  );
                })}
              </div>

              {/* הוצאות לא מתוקצבות */}
              {Object.keys(uncategorized).length > 0 && (
                <div className="mt-6 p-4 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                  <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> הוצאות לא מתוקצבות
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(uncategorized).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{cat}</span>
                        <span className="text-red-600 font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* דיאלוג יצירת/עריכת תקציב */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{exists ? 'עריכת תקציב' : 'תקציב חדש'} – {MONTHS_HE[month]} {year}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">תקציב כולל (₪)</label>
              <Input type="number" value={form.totalLimit} onChange={e => setForm(f => ({ ...f, totalLimit: e.target.value }))} placeholder="10000" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">קטגוריות תקציב</label>
              <div className="flex gap-2 mb-3">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                  <SelectContent>
                    {['מזון', 'דיור', 'תחבורה', 'חינוך', 'בריאות', 'ביגוד', 'בילויים', 'ביטוח', 'תקשורת', 'חיסכון', ...categories]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} placeholder="סכום" className="w-28" />
                <Button size="icon" onClick={addItem}><Plus className="h-4 w-4" /></Button>
              </div>

              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCurrency(Number(item.limit))}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeItem(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {form.items.length > 0 && (
                <div className="flex justify-between mt-2 pt-2 border-t text-sm">
                  <span className="text-slate-500">סה"כ מתוקצב:</span>
                  <span className={`font-bold ${totalBudgeted > Number(form.totalLimit) ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(totalBudgeted)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">סף התראה (%)</label>
              <Input type="number" value={form.alertThreshold} onChange={e => setForm(f => ({ ...f, alertThreshold: Number(e.target.value) }))} min="0" max="100" />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">הערות</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="הערות לתקציב..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>ביטול</Button>
            <Button onClick={saveBudget}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* דיאלוג סיכום שנתי */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>סיכום תקציב שנתי – {year}</DialogTitle>
          </DialogHeader>
          {summaryData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-xs text-slate-500">סה"כ תקציב</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(summaryData.yearTotal.totalLimit)}</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <p className="text-xs text-slate-500">סה"כ הוצאות</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(summaryData.yearTotal.totalSpent)}</p>
                </div>
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <p className="text-xs text-slate-500">חודשים בחריגה</p>
                  <p className="text-lg font-bold text-amber-600">{summaryData.yearTotal.monthsOverBudget}</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-xs text-slate-500">חודשים במעקב</p>
                  <p className="text-lg font-bold text-green-600">{summaryData.yearTotal.monthsTracked}</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={summaryData.monthlySummary.map(m => ({ ...m, name: MONTHS_HE[m.month] }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="totalLimit" name="תקציב" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalSpent" name="בפועל" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
