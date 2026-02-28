import { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Plus, Trash2, Pause, Play, Calendar, ArrowUpDown,
  CreditCard, Building, Wifi, Shield, Home, Car, Zap, TrendingDown, TrendingUp,
  Search, Check, X, Loader2, Lightbulb, ExternalLink
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import toast from 'react-hot-toast';

const SUBCATEGORY_MAP = {
  subscription: { label: 'מנוי', icon: Wifi, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  bill: { label: 'חשבון', icon: Zap, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  salary: { label: 'משכורת', icon: Building, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rent: { label: 'שכ"ד', icon: Home, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  insurance: { label: 'ביטוח', icon: Shield, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  loan_payment: { label: 'החזר הלוואה', icon: CreditCard, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  savings: { label: 'חיסכון', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  other: { label: 'אחר', icon: ArrowUpDown, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

const FREQUENCY_MAP = {
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
  yearly: 'שנתי',
};

export default function RecurringPage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetectDialog, setShowDetectDialog] = useState(false);
  const [detectLoading, setDetectLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [filter, setFilter] = useState('all'); // all, expenses, income, subscriptions

  const [form, setForm] = useState({
    description: '', amount: '', type: 'הוצאה', category: 'כללי', account: 'checking',
    frequency: 'monthly', dayOfMonth: '', startDate: new Date().toISOString().split('T')[0],
    endDate: '', subcategory: 'other', provider: '', notes: '',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [transRes, cashflowRes, insightsRes] = await Promise.all([
        api.get('/recurring'),
        api.get('/recurring/cashflow?months=6'),
        api.get('/analytics/recommendations').catch(() => null),
      ]);
      setTransactions(transRes.data.transactions);
      setSummary(transRes.data.summary);
      setForecast(cashflowRes.data.forecast);
      if (insightsRes) {
        const relevant = (insightsRes.data?.data?.recommendations || [])
          .filter(r => ['recurring_missing', 'budget_missing', 'goal_behind'].includes(r.type))
          .slice(0, 3);
        setInsights(relevant);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const addTransaction = async () => {
    if (!form.description || !form.amount || !form.startDate) {
      toast.error('נא למלא תיאור, סכום ותאריך התחלה');
      return;
    }
    try {
      await api.post('/recurring', {
        ...form,
        amount: Number(form.amount),
        dayOfMonth: form.dayOfMonth ? Number(form.dayOfMonth) : undefined,
      });
      toast.success('נוסף בהצלחה');
      setShowDialog(false);
      setForm({
        description: '', amount: '', type: 'הוצאה', category: 'כללי', account: 'checking',
        frequency: 'monthly', dayOfMonth: '', startDate: new Date().toISOString().split('T')[0],
        endDate: '', subcategory: 'other', provider: '', notes: '',
      });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהוספה');
    }
  };

  const toggleTransaction = async (id) => {
    try {
      const { data } = await api.post(`/recurring/${id}/toggle`);
      toast.success(data.message);
      fetchAll();
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await api.delete(`/recurring/${id}`);
      toast.success('נמחק בהצלחה');
      fetchAll();
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  const openDetect = async () => {
    setShowDetectDialog(true);
    setDetectLoading(true);
    setCandidates([]);
    setDismissed(new Set());
    try {
      const { data } = await api.get('/recurring/detect');
      setCandidates(data.candidates || []);
    } catch {
      toast.error('שגיאה בזיהוי דפוסים');
    }
    setDetectLoading(false);
  };

  const approveCandidate = async (c) => {
    try {
      await api.post('/recurring', {
        description: c.description,
        amount: c.amount,
        type: c.type,
        category: c.category,
        frequency: 'monthly',
        dayOfMonth: c.suggestedDay,
        startDate: new Date().toISOString().split('T')[0],
        subcategory: 'other',
      });
      toast.success(`"${c.description}" נוסף לקבועות`);
      setDismissed(prev => new Set([...prev, c.description]));
      fetchAll();
    } catch {
      toast.error('שגיאה בהוספה');
    }
  };

  const dismissCandidate = (description) => {
    setDismissed(prev => new Set([...prev, description]));
  };

  const MONTHS_HE = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  const filtered = useMemo(() => {
    switch (filter) {
      case 'expenses': return transactions.filter(t => t.type === 'הוצאה');
      case 'income': return transactions.filter(t => t.type === 'הכנסה');
      case 'subscriptions': return transactions.filter(t => t.subcategory === 'subscription');
      default: return transactions;
    }
  }, [transactions, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl" dir="rtl">
      {/* כותרת */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="h-7 w-7 text-blue-600" />
            הוצאות והכנסות קבועות
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            ניהול מנויים, חשבונות והעברות קבועות
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openDetect}>
            <Search className="h-4 w-4 me-2" /> זיהוי אוטומטי
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 me-2" /> הוסף חדש
          </Button>
        </div>
      </div>

      {/* InsightsBar — המלצות פעולה */}
      {insights.length > 0 && (
        <div className="space-y-2 mb-4">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm
              ${ins.priority === 'high'
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'}`}>
              <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="flex-1">{ins.suggestion}</span>
              {ins.actionUrl && (
                <a href={ins.actionUrl} className="flex items-center gap-1 font-medium underline underline-offset-2 shrink-0">
                  {ins.actionLabel} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* כרטיסי סיכום */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">הוצאות חודשיות קבועות</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalMonthlyExpenses || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">{formatCurrency(summary.totalAnnualExpenses || 0)} / שנה</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">הכנסות חודשיות קבועות</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalMonthlyIncome || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">{formatCurrency(summary.totalAnnualIncome || 0)} / שנה</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">נטו חודשי קבוע</p>
            <p className={`text-2xl font-bold ${(summary.totalMonthlyIncome || 0) - (summary.totalMonthlyExpenses || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency((summary.totalMonthlyIncome || 0) - (summary.totalMonthlyExpenses || 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">מנויים פעילים</p>
            <p className="text-2xl font-bold text-purple-600">{summary.subscriptionCount || 0}</p>
            <p className="text-xs text-slate-400 mt-1">{summary.activeCount || 0} פעילים • {summary.pausedCount || 0} מושהים</p>
          </CardContent>
        </Card>
      </div>

      {/* תחזית תזרים */}
      {forecast.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">תחזית תזרים מזומנים (6 חודשים)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={forecast.map(f => ({ ...f, month: MONTHS_HE[f.month] || f.month }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Area type="monotone" dataKey="income" name="הכנסה" fill="#10b98140" stroke="#10b981" />
                <Area type="monotone" dataKey="expenses" name="הוצאות" fill="#ef444440" stroke="#ef4444" />
                <Area type="monotone" dataKey="net" name="נטו" fill="#3b82f640" stroke="#3b82f6" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* פילטרים */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'הכל' },
          { key: 'expenses', label: 'הוצאות' },
          { key: 'income', label: 'הכנסות' },
          { key: 'subscriptions', label: 'מנויים' },
        ].map(f => (
          <Button key={f.key} variant={filter === f.key ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      {/* רשימת עסקאות */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((t, i) => {
            const sub = SUBCATEGORY_MAP[t.subcategory] || SUBCATEGORY_MAP.other;
            const SubIcon = sub.icon;
            return (
              <motion.div key={t._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={`${t.isPaused ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg ${sub.color}`}>
                          <SubIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">{t.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-500">{t.provider || t.category}</span>
                            <Badge variant="outline" className="text-xs">{FREQUENCY_MAP[t.frequency]}</Badge>
                            <Badge variant="outline" className="text-xs">{sub.label}</Badge>
                            {t.isPaused && <Badge variant="secondary" className="text-xs">מושהה</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <p className={`font-bold text-lg ${t.type === 'הכנסה' ? 'text-green-600' : 'text-red-600'}`}>
                            {t.type === 'הכנסה' ? '+' : '-'}{formatCurrency(t.amount)}
                          </p>
                          <p className="text-xs text-slate-400">{formatCurrency(t.annualCost || t.amount * 12)} / שנה</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleTransaction(t._id)}
                            title={t.isPaused ? 'הפעל' : 'השהה'}>
                            {t.isPaused ? <Play className="h-4 w-4 text-green-600" /> : <Pause className="h-4 w-4 text-amber-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteTransaction(t._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <RefreshCw className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p>אין עסקאות קבועות</p>
            <p className="text-sm">הוסף הוצאות והכנסות חוזרות כמו שכ"ד, מנויים ומשכורת</p>
          </div>
        )}
      </div>

      {/* דיאלוג זיהוי אוטומטי */}
      <Dialog open={showDetectDialog} onOpenChange={setShowDetectDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              זיהוי תשלומים קבועים אוטומטי
            </DialogTitle>
          </DialogHeader>

          {detectLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <p className="text-slate-500 text-sm">מנתח היסטוריית עסקאות...</p>
            </div>
          ) : candidates.filter(c => !dismissed.has(c.description)).length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Check className="h-12 w-12 mx-auto text-green-400 mb-3" />
              <p className="font-medium">לא נמצאו דפוסים חדשים</p>
              <p className="text-sm mt-1">כל הדפוסים שזוהו כבר מוגדרים, או שאין מספיק היסטוריה</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                זוהו <strong>{candidates.filter(c => !dismissed.has(c.description)).length}</strong> דפוסים חוזרים בהיסטוריית העסקאות. אשר או דחה כל אחד:
              </p>
              {candidates.filter(c => !dismissed.has(c.description)).map((c) => (
                <div key={c.description} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.description}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
                      <span className={c.type === 'הכנסה' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {c.type === 'הכנסה' ? '+' : '-'}{formatCurrency(c.amount)}
                      </span>
                      <span>{c.occurrenceCount} פעמים • {c.monthsCount} חודשים</span>
                      {c.suggestedDay && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />יום {c.suggestedDay}</span>}
                      <span className="text-blue-600">ביטחון: {Math.round(c.confidence * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => approveCandidate(c)} className="bg-green-600 hover:bg-green-700 text-white h-8 px-3">
                      <Check className="h-3.5 w-3.5 me-1" /> אשר
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismissCandidate(c.description)} className="h-8 px-3 text-slate-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetectDialog(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* דיאלוג הוספה */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת עסקה קבועה</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">תיאור *</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="למשל: נטפליקס" />
              </div>
              <div>
                <label className="text-sm font-medium">סכום (₪) *</label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="49.90" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">סוג</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="הוצאה">הוצאה</SelectItem>
                    <SelectItem value="הכנסה">הכנסה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">תדירות</label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">יומי</SelectItem>
                    <SelectItem value="weekly">שבועי</SelectItem>
                    <SelectItem value="monthly">חודשי</SelectItem>
                    <SelectItem value="yearly">שנתי</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">סיווג</label>
                <Select value={form.subcategory} onValueChange={v => setForm(f => ({ ...f, subcategory: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUBCATEGORY_MAP).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ספק/שירות</label>
                <Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="למשל: הוט" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">תאריך התחלה *</label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">תאריך סיום (אופציונלי)</label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {form.frequency === 'monthly' && (
              <div>
                <label className="text-sm font-medium">יום בחודש</label>
                <Input type="number" min="1" max="31" value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))} placeholder="1-31" />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">קטגוריה</label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="כללי" />
            </div>

            <div>
              <label className="text-sm font-medium">הערות</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="הערות..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>ביטול</Button>
            <Button onClick={addTransaction}>הוסף</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
