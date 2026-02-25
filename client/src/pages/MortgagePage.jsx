import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatPercent, formatDate } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { Home, Plus, Trash2, Edit2, TrendingUp, TrendingDown, Calculator, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';

const TRACK_TYPES = [
  { value: 'prime', label: 'פריים' },
  { value: 'fixed_unlinked', label: 'קבועה לא צמודה' },
  { value: 'fixed_linked', label: 'קבועה צמודה למדד' },
  { value: 'variable_5y', label: 'משתנה כל 5 שנים' },
  { value: 'variable_5y_linked', label: 'משתנה 5 צמודה' },
  { value: 'variable_other', label: 'משתנה אחר' },
  { value: 'eligibility', label: 'זכאות' },
];

const BANKS = ['לאומי', 'הפועלים', 'דיסקונט', 'מזרחי טפחות', 'בנק הבינלאומי', 'אחר'];

export default function MortgagePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showRefinance, setShowRefinance] = useState(null);
  const [showPrime, setShowPrime] = useState(null);
  const [refinanceResult, setRefinanceResult] = useState(null);
  const [primeResult, setPrimeResult] = useState(null);
  const [refinanceForm, setRefinanceForm] = useState({ newRate: '', newTermMonths: '' });

  const [form, setForm] = useState({
    propertyAddress: '', propertyValue: '', purchasePrice: '', purchaseDate: '',
    bank: '', originalTotalAmount: '', startDate: '',
    lifeInsuranceCost: '', structureInsuranceCost: '', notes: '',
    tracks: [{ name: '', type: 'prime', originalAmount: '', currentBalance: '', interestRate: '', monthlyPayment: '', termInMonths: '', remainingMonths: '', repaymentType: 'שפיצר' }],
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data } = await api.get('/mortgages');
      setData(data);
    } catch { toast.error('שגיאה בטעינת משכנתאות'); }
    setLoading(false);
  };

  const addTrack = () => {
    setForm({ ...form, tracks: [...form.tracks, { name: '', type: 'prime', originalAmount: '', currentBalance: '', interestRate: '', monthlyPayment: '', termInMonths: '', remainingMonths: '', repaymentType: 'שפיצר' }] });
  };

  const removeTrack = (idx) => {
    setForm({ ...form, tracks: form.tracks.filter((_, i) => i !== idx) });
  };

  const updateTrack = (idx, field, value) => {
    const tracks = [...form.tracks];
    tracks[idx] = { ...tracks[idx], [field]: value };
    setForm({ ...form, tracks });
  };

  const handleSubmit = async () => {
    if (!form.originalTotalAmount || !form.startDate) return toast.error('מלא שדות חובה');
    try {
      const payload = {
        ...form,
        propertyValue: Number(form.propertyValue) || 0,
        purchasePrice: Number(form.purchasePrice) || 0,
        originalTotalAmount: Number(form.originalTotalAmount),
        lifeInsuranceCost: Number(form.lifeInsuranceCost) || 0,
        structureInsuranceCost: Number(form.structureInsuranceCost) || 0,
        tracks: form.tracks.map(t => ({
          ...t,
          originalAmount: Number(t.originalAmount) || 0,
          currentBalance: Number(t.currentBalance) || 0,
          interestRate: Number(t.interestRate) || 0,
          monthlyPayment: Number(t.monthlyPayment) || 0,
          termInMonths: Number(t.termInMonths) || 0,
          remainingMonths: Number(t.remainingMonths) || 0,
        })),
      };
      if (editing) {
        await api.put(`/mortgages/${editing}`, payload);
        toast.success('משכנתא עודכנה');
      } else {
        await api.post('/mortgages', payload);
        toast.success('משכנתא נוספה');
      }
      setShowDialog(false); setEditing(null); fetchData();
    } catch { toast.error('שגיאה בשמירה'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק משכנתא?')) return;
    try { await api.delete(`/mortgages/${id}`); toast.success('נמחקה'); fetchData(); }
    catch { toast.error('שגיאה'); }
  };

  const handleRefinance = async (id) => {
    try {
      const { data } = await api.post(`/mortgages/${id}/simulate-refinance`, {
        newRate: Number(refinanceForm.newRate),
        newTermMonths: Number(refinanceForm.newTermMonths),
      });
      setRefinanceResult(data);
    } catch { toast.error('שגיאה בסימולציה'); }
  };

  const handlePrimeScenario = async (id) => {
    try {
      const { data } = await api.get(`/mortgages/${id}/prime-scenario`);
      setPrimeResult(data);
      setShowPrime(id);
    } catch { toast.error('שגיאה'); }
  };

  if (loading) return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const { mortgages = [], summary = {} } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Home className="h-7 w-7 text-blue-500" /> משכנתאות</h1>
          <p className="text-sm text-gray-500 mt-1">מעקב מסלולים, סימולציית מיחזור ותרחישי ריבית</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ propertyAddress:'', propertyValue:'', purchasePrice:'', purchaseDate:'', bank:'', originalTotalAmount:'', startDate:'', lifeInsuranceCost:'', structureInsuranceCost:'', notes:'', tracks:[{ name:'', type:'prime', originalAmount:'', currentBalance:'', interestRate:'', monthlyPayment:'', termInMonths:'', remainingMonths:'', repaymentType:'שפיצר' }] }); setShowDialog(true); }}>
          <Plus className="h-4 w-4 me-1" /> משכנתא חדשה
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">יתרה כוללת</p><p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalBalance)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">תשלום חודשי</p><p className="text-xl font-bold text-orange-600">{formatCurrency(summary.totalMonthlyPayment)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">ריבית משוקללת</p><p className="text-xl font-bold text-blue-600">{formatPercent(summary.avgWeightedRate)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-gray-500">מספר משכנתאות</p><p className="text-xl font-bold">{summary.count}</p></CardContent></Card>
      </div>

      {/* Mortgage Cards */}
      {mortgages.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400"><Home className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>אין משכנתאות. הוסף את הראשונה!</p></CardContent></Card>
      ) : mortgages.map(m => (
        <motion.div key={m._id} initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <Card className="hover:shadow-md transition">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{m.propertyAddress || 'משכנתא'}</CardTitle>
                  <p className="text-xs text-gray-500">{m.bank} • {formatDate(m.startDate)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowRefinance(m._id); setRefinanceResult(null); setRefinanceForm({ newRate:'', newTermMonths:'' }); }}><Calculator className="h-4 w-4 me-1" />מיחזור</Button>
                  <Button size="sm" variant="outline" onClick={() => handlePrimeScenario(m._id)}><BarChart3 className="h-4 w-4 me-1" />פריים</Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(m._id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 mb-4 text-center text-sm">
                <div><p className="text-gray-500 text-xs">יתרה</p><p className="font-bold text-red-600">{formatCurrency(m.totalCurrentBalance)}</p></div>
                <div><p className="text-gray-500 text-xs">החזר חודשי</p><p className="font-bold">{formatCurrency(m.totalMonthlyPayment)}</p></div>
                <div><p className="text-gray-500 text-xs">ריבית משוקללת</p><p className="font-bold">{formatPercent(m.weightedInterestRate)}</p></div>
                <div><p className="text-gray-500 text-xs">LTV</p><p className="font-bold">{formatPercent(m.ltv)}</p></div>
              </div>
              {m.ltv > 0 && <Progress value={Math.min(100, m.ltv)} className="h-2 mb-4" />}
              
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">מסלולים:</p>
                {m.tracks?.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded p-2 text-sm">
                    <div>
                      <span className="font-medium">{t.name || TRACK_TYPES.find(tt => tt.value === t.type)?.label}</span>
                      <Badge variant="outline" className="ms-2 text-xs">{TRACK_TYPES.find(tt => tt.value === t.type)?.label}</Badge>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span>יתרה: {formatCurrency(t.currentBalance)}</span>
                      <span>ריבית: {formatPercent(t.interestRate)}</span>
                      <span>החזר: {formatCurrency(t.monthlyPayment)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Refinance Dialog */}
      <Dialog open={!!showRefinance} onOpenChange={() => setShowRefinance(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>סימולציית מיחזור</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">ריבית חדשה (%)</label><Input type="number" step="0.1" value={refinanceForm.newRate} onChange={e => setRefinanceForm({...refinanceForm, newRate: e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">תקופה (חודשים)</label><Input type="number" value={refinanceForm.newTermMonths} onChange={e => setRefinanceForm({...refinanceForm, newTermMonths: e.target.value})} /></div>
          </div>
          <Button onClick={() => handleRefinance(showRefinance)} className="w-full">חשב</Button>
          {refinanceResult && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">החזר חודשי חדש</p><p className="font-bold text-lg">{formatCurrency(refinanceResult.newMonthlyPayment)}</p></CardContent></Card>
                <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">חיסכון חודשי</p><p className="font-bold text-lg text-green-600">{formatCurrency(refinanceResult.monthlySavings)}</p></CardContent></Card>
              </div>
              <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">חיסכון כולל</p><p className="font-bold text-xl text-green-600">{formatCurrency(refinanceResult.totalSavings)}</p></CardContent></Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prime Scenario Dialog */}
      <Dialog open={!!showPrime} onOpenChange={() => setShowPrime(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>תרחישי ריבית פריים</DialogTitle></DialogHeader>
          {primeResult && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">תשלום נוכחי: {formatCurrency(primeResult.currentPayment)}</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={primeResult.results}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Bar dataKey="monthlyPayment" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-1">
                {primeResult.results.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b">
                    <span>{r.label}</span>
                    <span className="font-bold">{formatCurrency(r.monthlyPayment)}</span>
                    <span className={r.diff > 0 ? 'text-red-500' : r.diff < 0 ? 'text-green-500' : ''}>{r.diff > 0 ? '+' : ''}{formatCurrency(r.diff)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'עריכת משכנתא' : 'משכנתא חדשה'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">כתובת הנכס</label><Input value={form.propertyAddress} onChange={e => setForm({...form, propertyAddress: e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">שווי הנכס</label><Input type="number" value={form.propertyValue} onChange={e => setForm({...form, propertyValue: e.target.value})} /></div>
            <div>
              <label className="text-xs text-gray-500">בנק</label>
              <Select value={form.bank} onValueChange={v => setForm({...form, bank: v})}>
                <SelectTrigger><SelectValue placeholder="בחר בנק" /></SelectTrigger>
                <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-gray-500">סכום מקורי *</label><Input type="number" value={form.originalTotalAmount} onChange={e => setForm({...form, originalTotalAmount: e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">תאריך התחלה *</label><Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
            <div><label className="text-xs text-gray-500">ביטוח חיים/חודש</label><Input type="number" value={form.lifeInsuranceCost} onChange={e => setForm({...form, lifeInsuranceCost: e.target.value})} /></div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">מסלולים</p>
              <Button size="sm" variant="outline" onClick={addTrack}><Plus className="h-3 w-3 me-1" />מסלול</Button>
            </div>
            {form.tracks.map((t, i) => (
              <div key={i} className="border rounded p-3 mb-2 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">מסלול {i+1}</p>
                  {form.tracks.length > 1 && <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeTrack(i)}><Trash2 className="h-3 w-3" /></Button>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-xs text-gray-500">שם</label><Input value={t.name} onChange={e => updateTrack(i, 'name', e.target.value)} /></div>
                  <div>
                    <label className="text-xs text-gray-500">סוג</label>
                    <Select value={t.type} onValueChange={v => updateTrack(i, 'type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TRACK_TYPES.map(tt => <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><label className="text-xs text-gray-500">סכום מקורי *</label><Input type="number" value={t.originalAmount} onChange={e => updateTrack(i, 'originalAmount', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">יתרה נוכחית</label><Input type="number" value={t.currentBalance} onChange={e => updateTrack(i, 'currentBalance', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">ריבית (%)</label><Input type="number" step="0.01" value={t.interestRate} onChange={e => updateTrack(i, 'interestRate', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">החזר חודשי</label><Input type="number" value={t.monthlyPayment} onChange={e => updateTrack(i, 'monthlyPayment', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">תקופה (חודשים) *</label><Input type="number" value={t.termInMonths} onChange={e => updateTrack(i, 'termInMonths', e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">חודשים שנותרו</label><Input type="number" value={t.remainingMonths} onChange={e => updateTrack(i, 'remainingMonths', e.target.value)} /></div>
                  <div>
                    <label className="text-xs text-gray-500">שיטת החזר</label>
                    <Select value={t.repaymentType} onValueChange={v => updateTrack(i, 'repaymentType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="שפיצר">שפיצר</SelectItem>
                        <SelectItem value="קרן שווה">קרן שווה</SelectItem>
                        <SelectItem value="בלון">בלון</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={handleSubmit}>{editing ? 'עדכן' : 'הוסף'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
