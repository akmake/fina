import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Baby, Plus, Pencil, Trash2, Banknote, PiggyBank, GraduationCap } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';

const TYPES = { government: 'חיסכון ממשלתי', provident_fund: 'קופת גמל', bank_savings: 'חיסכון בנקאי', investment_account: 'תיק השקעות', education_fund: 'קרן השתלמות', other: 'אחר' };
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];

const emptyForm = { childName:'', childBirthDate:'', type:'government', bankOrProvider:'', currentBalance:'', monthlyDeposit:'', interestRate:'', startDate:'', maturityDate:'', governmentDeposit:'', parentDeposit:'', notes:'' };

export default function ChildSavingsPage() {
  const [savings, setSavings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const { data } = await api.get('/child-savings');
      setSavings(data.savings || []);
      setSummary(data.summary || null);
    } catch { toast.error('שגיאה בטעינה'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s) => {
    setEditing(s._id);
    setForm({
      childName: s.childName||'', childBirthDate: s.childBirthDate?.slice(0,10)||'', type: s.type,
      bankOrProvider: s.bankOrProvider||'', currentBalance: s.currentBalance||'', monthlyDeposit: s.monthlyDeposit||'',
      interestRate: s.interestRate||'', startDate: s.startDate?.slice(0,10)||'', maturityDate: s.maturityDate?.slice(0,10)||'',
      governmentDeposit: s.governmentDeposit||'', parentDeposit: s.parentDeposit||'', notes: s.notes||'',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.childName) return toast.error('שם ילד/ה חובה');
    try {
      const body = { ...form, currentBalance: Number(form.currentBalance)||0, monthlyDeposit: Number(form.monthlyDeposit)||0, interestRate: Number(form.interestRate)||0, governmentDeposit: Number(form.governmentDeposit)||0, parentDeposit: Number(form.parentDeposit)||0 };
      if (editing) await api.put(`/child-savings/${editing}`, body);
      else await api.post('/child-savings', body);
      toast.success(editing ? 'עודכן' : 'נוסף');
      setDialogOpen(false); load();
    } catch { toast.error('שגיאה בשמירה'); }
  };

  const remove = async (id) => {
    if (!confirm('למחוק?')) return;
    try { await api.delete(`/child-savings/${id}`); toast.success('נמחק'); load(); } catch { toast.error('שגיאה'); }
  };

  // Group by child
  const groupedByChild = savings.reduce((acc, s) => {
    const key = s.childName || 'ללא שם';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const pieData = Object.entries(groupedByChild).map(([name, items]) => ({
    name,
    value: items.reduce((sum, s) => sum + (s.currentBalance || 0), 0),
  }));

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Baby className="h-7 w-7 text-pink-500" /> חיסכון לילדים</h1>
          <p className="text-sm text-gray-500 mt-1">מעקב חסכונות ממשלתיים ופרטיים לכל ילד</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 me-1" /> הוספת חיסכון</Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-pink-50 dark:bg-pink-950 border-pink-200"><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">סך הכל חסכונות</p>
            <p className="text-xl font-bold text-pink-600">{formatCurrency(summary.totalBalance)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">הפקדות חודשיות</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(summary.totalMonthlyDeposits)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">מספר ילדים</p>
            <p className="text-xl font-bold">{summary.childCount || Object.keys(groupedByChild).length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">מספר חסכונות</p>
            <p className="text-xl font-bold">{savings.length}</p>
          </CardContent></Card>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Pie Chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">חלוקה לפי ילד</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Grouped List */}
        <div className={`space-y-4 ${pieData.length > 0 ? 'md:col-span-2' : 'md:col-span-3'}`}>
          {savings.length === 0 && <Card><CardContent className="py-12 text-center text-gray-500">אין חסכונות. הוסף את הראשון!</CardContent></Card>}

          {Object.entries(groupedByChild).map(([childName, items]) => (
            <div key={childName}>
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Baby className="h-4 w-4 text-pink-500" />
                {childName}
                {items[0]?.childAge != null && <Badge variant="outline" className="text-xs">גיל {items[0].childAge}</Badge>}
                <span className="text-gray-400 font-normal">—</span>
                <span className="text-pink-600 font-bold">{formatCurrency(items.reduce((s, x) => s + (x.currentBalance||0), 0))}</span>
              </h3>
              {items.map(s => (
                <Card key={s._id} className="mb-2 hover:shadow-md transition-shadow">
                  <CardContent className="py-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {s.type === 'government' ? <Banknote className="h-4 w-4 text-green-500" /> :
                           s.type === 'education_fund' ? <GraduationCap className="h-4 w-4 text-blue-500" /> :
                           <PiggyBank className="h-4 w-4 text-yellow-500" />}
                          <Badge variant="secondary" className="text-xs">{TYPES[s.type]}</Badge>
                          {s.bankOrProvider && <span className="text-xs text-gray-500">{s.bankOrProvider}</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500 mt-1">
                          {s.monthlyDeposit > 0 && <span>הפקדה: {formatCurrency(s.monthlyDeposit)}/חודש</span>}
                          {s.interestRate > 0 && <span>ריבית: {s.interestRate}%</span>}
                          {s.maturityDate && <span>תאריך פדיון: {formatDate(s.maturityDate)}</span>}
                          {s.profitLoss != null && s.profitLoss !== 0 && (
                            <span className={s.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                              רווח/הפסד: {formatCurrency(s.profitLoss)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-pink-600">{formatCurrency(s.currentBalance)}</span>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(s._id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'עריכת חיסכון' : 'הוספת חיסכון'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="שם הילד/ה *" value={form.childName} onChange={e => setForm({...form, childName: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">תאריך לידה</label>
                <Input type="date" value={form.childBirthDate} onChange={e => setForm({...form, childBirthDate: e.target.value})} />
              </div>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                <SelectTrigger><SelectValue placeholder="סוג" /></SelectTrigger>
                <SelectContent>{Object.entries(TYPES).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="בנק / ספק" value={form.bankOrProvider} onChange={e => setForm({...form, bankOrProvider: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="יתרה נוכחית" value={form.currentBalance} onChange={e => setForm({...form, currentBalance: e.target.value})} />
              <Input type="number" placeholder="הפקדה חודשית" value={form.monthlyDeposit} onChange={e => setForm({...form, monthlyDeposit: e.target.value})} />
            </div>
            <Input type="number" placeholder="ריבית %" value={form.interestRate} onChange={e => setForm({...form, interestRate: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">תאריך התחלה</label>
                <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-gray-500">תאריך פדיון</label>
                <Input type="date" value={form.maturityDate} onChange={e => setForm({...form, maturityDate: e.target.value})} />
              </div>
            </div>
            {form.type === 'government' && (
              <>
                <h4 className="text-sm font-medium pt-2 border-t">חיסכון ממשלתי</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="הפקדת ממשלה" value={form.governmentDeposit} onChange={e => setForm({...form, governmentDeposit: e.target.value})} />
                  <Input type="number" placeholder="הפקדת הורה" value={form.parentDeposit} onChange={e => setForm({...form, parentDeposit: e.target.value})} />
                </div>
              </>
            )}
            <Input placeholder="הערות" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={save}>שמירה</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
