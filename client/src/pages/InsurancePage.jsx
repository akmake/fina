import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Trash2, Edit2, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = [
  { value: 'health', label: 'ביטוח בריאות' },
  { value: 'life', label: 'ביטוח חיים' },
  { value: 'disability', label: 'אובדן כושר עבודה' },
  { value: 'car_mandatory', label: 'רכב חובה' },
  { value: 'car_comprehensive', label: 'רכב מקיף' },
  { value: 'home_structure', label: 'ביטוח מבנה' },
  { value: 'home_contents', label: 'ביטוח תכולה' },
  { value: 'travel', label: 'נסיעות לחו"ל' },
  { value: 'dental', label: 'ביטוח שיניים' },
  { value: 'umbrella', label: 'מטריה / צד ג׳' },
  { value: 'business', label: 'ביטוח עסקי' },
  { value: 'other', label: 'אחר' },
];

const FREQ_OPTIONS = [
  { value: 'monthly', label: 'חודשי' },
  { value: 'quarterly', label: 'רבעוני' },
  { value: 'semi_annual', label: 'חצי שנתי' },
  { value: 'annual', label: 'שנתי' },
];

const COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#6366f1','#14b8a6','#e11d48'];

const emptyForm = {
  type: '', name: '', company: '', policyNumber: '', agentName: '', agentPhone: '',
  monthlyCost: '', paymentFrequency: 'monthly', deductible: '', coverageAmount: '',
  coverageDetails: '', startDate: '', endDate: '', renewalDate: '', autoRenew: true, notes: '',
};

export default function InsurancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data } = await api.get('/insurance');
      setData(data);
    } catch { toast.error('שגיאה בטעינת ביטוחים'); }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.type || !form.name || !form.monthlyCost) return toast.error('מלא שדות חובה');
    if (!form.startDate) return toast.error('תאריך תחילת ביטוח חובה');
    try {
      if (editing) {
        await api.put(`/insurance/${editing}`, { ...form, monthlyCost: Number(form.monthlyCost) });
        toast.success('פוליסה עודכנה');
      } else {
        await api.post('/insurance', { ...form, monthlyCost: Number(form.monthlyCost) });
        toast.success('פוליסה נוספה');
      }
      setShowDialog(false); setEditing(null); setForm(emptyForm); fetchData();
    } catch { toast.error('שגיאה בשמירה'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק פוליסה?')) return;
    try { await api.delete(`/insurance/${id}`); toast.success('נמחקה'); fetchData(); }
    catch { toast.error('שגיאה'); }
  };

  const openEdit = (policy) => {
    setEditing(policy._id);
    setForm({
      type: policy.type, name: policy.name, company: policy.company || '',
      policyNumber: policy.policyNumber || '', agentName: policy.agentName || '',
      agentPhone: policy.agentPhone || '', monthlyCost: policy.monthlyCost.toString(),
      paymentFrequency: policy.paymentFrequency, deductible: policy.deductible?.toString() || '',
      coverageAmount: policy.coverageAmount?.toString() || '', coverageDetails: policy.coverageDetails || '',
      startDate: policy.startDate?.split('T')[0] || '', endDate: policy.endDate?.split('T')[0] || '',
      renewalDate: policy.renewalDate?.split('T')[0] || '', autoRenew: policy.autoRenew, notes: policy.notes || '',
    });
    setShowDialog(true);
  };

  if (loading) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const { policies = [], summary = {}, typeLabels = {} } = data || {};

  const chartData = Object.entries(
    policies.filter(p => p.status === 'active').reduce((acc, p) => {
      const label = typeLabels[p.type] || p.type;
      acc[label] = (acc[label] || 0) + (p.monthlyCost || 0);
      return acc;
    }, {})
  ).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-7 w-7 text-blue-500" /> ביטוחים</h1>
          <p className="text-sm text-gray-500 mt-1">ניהול ומעקב אחר כל פוליסות הביטוח שלך</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowDialog(true); }}>
          <Plus className="h-4 w-4 me-1" /> פוליסה חדשה
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-gray-500">עלות חודשית</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalMonthlyCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-gray-500">עלות שנתית</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalAnnualCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-gray-500">פוליסות פעילות</p>
          <p className="text-xl font-bold text-blue-600">{summary.activePolicies}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-gray-500">חידושים קרובים</p>
          <p className="text-xl font-bold text-orange-500">{summary.renewalsSoon}</p>
        </CardContent></Card>
      </div>

      {/* Chart + Policies */}
      <div className="grid md:grid-cols-3 gap-6">
        {chartData.length > 0 && (
          <Card className="md:col-span-1">
            <CardHeader><CardTitle className="text-sm">התפלגות עלות חודשית</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className={chartData.length > 0 ? "md:col-span-2 space-y-3" : "md:col-span-3 space-y-3"}>
          <AnimatePresence>
            {policies.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-400">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>אין פוליסות ביטוח. הוסף את הראשונה!</p>
              </CardContent></Card>
            ) : policies.map(p => (
              <motion.div key={p._id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                <Card className={`hover:shadow-md transition ${p.isRenewalSoon ? 'border-orange-300 bg-orange-50/30 dark:border-orange-700 dark:bg-orange-950/20' : ''}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{p.name}</span>
                            <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status === 'active' ? 'פעילה' : p.status === 'expired' ? 'פג תוקף' : 'מבוטלת'}</Badge>
                            {p.isRenewalSoon && <Badge variant="outline" className="text-orange-600 border-orange-300"><Clock className="h-3 w-3 me-1" />חידוש קרוב</Badge>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                            <span>{typeLabels[p.type] || p.type}</span>
                            {p.company && <span>• {p.company}</span>}
                            {p.policyNumber && <span>• מס׳ {p.policyNumber}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="font-bold text-red-600">{formatCurrency(p.monthlyCost)}<span className="text-xs text-gray-400">/חודש</span></p>
                          {p.coverageAmount > 0 && <p className="text-xs text-gray-500">כיסוי: {formatCurrency(p.coverageAmount)}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(p._id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'עריכת פוליסה' : 'פוליסה חדשה'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500">סוג ביטוח *</label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                <SelectContent>{TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-gray-500">שם *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">חברה</label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="מגדל, הראל..." /></div>
            <div><label className="text-xs text-gray-500">עלות חודשית *</label><Input type="number" value={form.monthlyCost} onChange={e => setForm({ ...form, monthlyCost: e.target.value })} /></div>
            <div>
              <label className="text-xs text-gray-500">תדירות תשלום</label>
              <Select value={form.paymentFrequency} onValueChange={v => setForm({ ...form, paymentFrequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-gray-500">מספר פוליסה</label><Input value={form.policyNumber} onChange={e => setForm({ ...form, policyNumber: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">סכום כיסוי</label><Input type="number" value={form.coverageAmount} onChange={e => setForm({ ...form, coverageAmount: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">השתתפות עצמית</label><Input type="number" value={form.deductible} onChange={e => setForm({ ...form, deductible: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">שם סוכן</label><Input value={form.agentName} onChange={e => setForm({ ...form, agentName: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">טלפון סוכן</label><Input value={form.agentPhone} onChange={e => setForm({ ...form, agentPhone: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">תחילת ביטוח *</label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">סיום ביטוח</label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500">תאריך חידוש</label><Input type="date" value={form.renewalDate} onChange={e => setForm({ ...form, renewalDate: e.target.value })} /></div>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="autoRenew" checked={form.autoRenew} onChange={e => setForm({ ...form, autoRenew: e.target.checked })} />
              <label htmlFor="autoRenew" className="text-xs text-gray-500">חידוש אוטומטי</label>
            </div>
            <div className="col-span-2"><label className="text-xs text-gray-500">פרטי כיסוי</label><Input value={form.coverageDetails} onChange={e => setForm({ ...form, coverageDetails: e.target.value })} /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500">הערות</label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleSubmit}>{editing ? 'עדכן' : 'הוסף'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
