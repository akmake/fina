import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Trash2, Edit2, TrendingUp, CheckCircle, Clock, DollarSign, ArrowUp } from 'lucide-react';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = { high: 'text-red-600', medium: 'text-orange-500', low: 'text-green-600' };
const PRIORITY_LABELS = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' };
const STATUS_LABELS = { active: 'פעיל', completed: 'הושלם', paused: 'מושהה', cancelled: 'בוטל' };

const emptyForm = {
  name: '', description: '', category: '', targetAmount: '', currentAmount: '',
  monthlyContribution: '', targetDate: '', priority: 'medium', notes: '',
};

export default function GoalsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [depositDialog, setDepositDialog] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [filter, setFilter] = useState('active');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data } = await api.get('/goals');
      setData(data);
    } catch { toast.error('שגיאה בטעינת יעדים'); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.category || !form.targetAmount) return toast.error('מלא שדות חובה');
    try {
      const payload = {
        ...form,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount) || 0,
        monthlyContribution: Number(form.monthlyContribution) || 0,
      };
      if (editing) {
        await api.put(`/goals/${editing}`, payload);
        toast.success('יעד עודכן');
      } else {
        await api.post('/goals', payload);
        toast.success('יעד נוסף');
      }
      setShowDialog(false); setEditing(null); setForm(emptyForm); fetchData();
    } catch { toast.error('שגיאה'); }
  };

  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) return toast.error('סכום לא תקין');
    try {
      await api.post(`/goals/${depositDialog}/deposit`, { amount: Number(depositAmount) });
      toast.success('הפקדה בוצעה!');
      setDepositDialog(null); setDepositAmount('');
      fetchData();
    } catch { toast.error('שגיאה'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק יעד?')) return;
    try { await api.delete(`/goals/${id}`); toast.success('נמחק'); fetchData(); }
    catch { toast.error('שגיאה'); }
  };

  if (loading) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const { goals = [], summary = {}, categoryLabels = {}, categoryIcons = {} } = data || {};
  const filteredGoals = filter === 'all' ? goals : goals.filter(g => g.status === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-7 w-7 text-blue-500" /> יעדים פיננסיים</h1>
          <p className="text-sm text-gray-500 mt-1">הגדר יעדים ועקוב אחרי ההתקדמות</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowDialog(true); }}>
          <Plus className="h-4 w-4 me-1" /> יעד חדש
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">יעדים פעילים</p><p className="text-xl font-bold text-blue-600">{summary.active}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">הושלמו</p><p className="text-xl font-bold text-green-600">{summary.completed}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">סה״כ יעד</p><p className="text-xl font-bold">{formatCurrency(summary.totalTarget)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">סה״כ נחסך</p><p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalSaved)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">בזמן / מפגרים</p><p className="text-xl font-bold"><span className="text-green-600">{summary.onTrack}</span> / <span className="text-red-500">{summary.behindSchedule}</span></p></CardContent></Card>
      </div>

      {/* Overall progress */}
      {summary.active > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">התקדמות כוללת</span>
              <span className="text-sm font-bold">{summary.overallProgress?.toFixed(0)}%</span>
            </div>
            <Progress value={summary.overallProgress || 0} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {[{v:'active',l:'פעילים'},{v:'completed',l:'הושלמו'},{v:'all',l:'הכל'}].map(f => (
          <Button key={f.v} size="sm" variant={filter === f.v ? 'default' : 'outline'} onClick={() => setFilter(f.v)}>{f.l}</Button>
        ))}
      </div>

      {/* Goals */}
      <div className="grid md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredGoals.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="py-12 text-center text-gray-400"><Target className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>אין יעדים. הגדר את הראשון!</p></CardContent></Card>
          ) : filteredGoals.map(g => (
            <motion.div key={g._id} initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}>
              <Card className={`hover:shadow-md transition ${g.status === 'completed' ? 'border-green-300 bg-green-50/30 dark:border-green-700' : !g.isOnTrack && g.targetDate ? 'border-red-200' : ''}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{g.icon || categoryIcons[g.category] || '🎯'}</span>
                      <div>
                        <h3 className="font-bold text-lg">{g.name}</h3>
                        <div className="flex gap-2 items-center text-xs text-gray-500">
                          <span>{categoryLabels[g.category]}</span>
                          <Badge variant="outline" className={PRIORITY_COLORS[g.priority]}>{PRIORITY_LABELS[g.priority]}</Badge>
                          {g.status === 'completed' && <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 me-1" />הושלם</Badge>}
                          {!g.isOnTrack && g.status === 'active' && g.targetDate && <Badge variant="destructive"><Clock className="h-3 w-3 me-1" />מפגר</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {g.status === 'active' && <Button size="sm" variant="outline" className="text-green-600" onClick={() => { setDepositDialog(g._id); setDepositAmount(''); }}><DollarSign className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(g._id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{formatCurrency(g.currentAmount)} מתוך {formatCurrency(g.targetAmount)}</span>
                      <span className="font-bold">{g.progressPercent?.toFixed(0)}%</span>
                    </div>
                    <Progress value={g.progressPercent || 0} className="h-3" />
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>חסר: {formatCurrency(g.remaining)}</span>
                    {g.monthlyContribution > 0 && <span>הפקדה: {formatCurrency(g.monthlyContribution)}/חודש</span>}
                    {g.monthsToGoal > 0 && <span>עוד {g.monthsToGoal} חודשים</span>}
                  </div>

                  {g.description && <p className="text-xs text-gray-400 mt-2">{g.description}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Deposit Dialog */}
      <Dialog open={!!depositDialog} onOpenChange={() => setDepositDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>הפקדה ליעד</DialogTitle></DialogHeader>
          <div><label className="text-xs text-gray-500">סכום להפקדה</label><Input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="₪" /></div>
          <DialogFooter><Button onClick={handleDeposit}><ArrowUp className="h-4 w-4 me-1" />הפקד</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'עריכת יעד' : 'יעד חדש'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">שם היעד *</label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="קניית דירה, חתונה..." /></div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">קטגוריה *</label>
              <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k,v]) => <SelectItem key={k} value={k}>{categoryIcons[k]} {v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-gray-500">סכום יעד *</label><Input type="number" value={form.targetAmount} onChange={e => setForm({...form, targetAmount: e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">סכום נוכחי</label><Input type="number" value={form.currentAmount} onChange={e => setForm({...form, currentAmount: e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">הפקדה חודשית</label><Input type="number" value={form.monthlyContribution} onChange={e => setForm({...form, monthlyContribution: e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">תאריך יעד</label><Input type="date" value={form.targetDate} onChange={e => setForm({...form, targetDate: e.target.value})} /></div>
            <div>
              <label className="text-xs text-gray-500">עדיפות</label>
              <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">גבוהה</SelectItem>
                  <SelectItem value="medium">בינונית</SelectItem>
                  <SelectItem value="low">נמוכה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-gray-500">תיאור</label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleSubmit}>{editing ? 'עדכן' : 'הוסף'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
