import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatPercent, formatDate } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, Pencil, Trash2, TrendingUp, Home, DollarSign, MapPin } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';

const PROPERTY_TYPES = { apartment: 'דירה', house: 'בית', penthouse: 'פנטהאוז', duplex: 'דופלקס', studio: 'סטודיו', land: 'קרקע', commercial: 'מסחרי', other: 'אחר' };
const USAGE_TYPES = { primary_residence: 'מגורים עיקריים', investment: 'להשקעה', vacation: 'נופש', commercial: 'מסחרי' };
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

const emptyForm = { name:'', address:'', propertyType:'apartment', usageType:'primary_residence', purchasePrice:'', purchaseDate:'', currentValue:'', size:'', rooms:'', monthlyRent:'', tenantName:'', leaseEndDate:'', maintenanceCost:'', arnonaCost:'', insuranceCost:'', otherExpenses:'', linkedMortgage:'', notes:'' };

export default function RealEstatePage() {
  const [properties, setProperties] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [mortgages, setMortgages] = useState([]);

  const load = async () => {
    try {
      const [propRes, mortRes] = await Promise.all([
        api.get('/real-estate'),
        api.get('/mortgages').catch(() => ({ data: [] })),
      ]);
      setProperties(propRes.data?.properties || []);
      setSummary(propRes.data?.summary || null);
      setMortgages(mortRes.data?.mortgages || mortRes.data || []);
    } catch { toast.error('שגיאה בטעינה'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditing(p._id);
    setForm({
      name: p.name||'', address: p.address||'', propertyType: p.propertyType, usageType: p.usageType,
      purchasePrice: p.purchasePrice||'', purchaseDate: p.purchaseDate?.slice(0,10)||'', currentValue: p.currentValue||'',
      size: p.size||'', rooms: p.rooms||'', monthlyRent: p.monthlyRent||'', tenantName: p.tenantName||'',
      leaseEndDate: p.leaseEndDate?.slice(0,10)||'', maintenanceCost: p.maintenanceCost||'', arnonaCost: p.arnonaCost||'',
      insuranceCost: p.insuranceCost||'', otherExpenses: p.otherExpenses||'', linkedMortgage: p.linkedMortgage||'', notes: p.notes||'',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error('שם נכס חובה');
    try {
      const body = { ...form, purchasePrice: Number(form.purchasePrice)||0, currentValue: Number(form.currentValue)||0, size: Number(form.size)||0, rooms: Number(form.rooms)||0, monthlyRent: Number(form.monthlyRent)||0, maintenanceCost: Number(form.maintenanceCost)||0, arnonaCost: Number(form.arnonaCost)||0, insuranceCost: Number(form.insuranceCost)||0, otherExpenses: Number(form.otherExpenses)||0 };
      if (!body.linkedMortgage) delete body.linkedMortgage;
      if (editing) await api.put(`/real-estate/${editing}`, body);
      else await api.post('/real-estate', body);
      toast.success(editing ? 'עודכן' : 'נוסף');
      setDialogOpen(false); load();
    } catch { toast.error('שגיאה בשמירה'); }
  };

  const remove = async (id) => {
    if (!confirm('למחוק?')) return;
    try { await api.delete(`/real-estate/${id}`); toast.success('נמחק'); load(); } catch { toast.error('שגיאה'); }
  };

  const pieData = properties.map(p => ({ name: p.name, value: p.currentValue || p.purchasePrice }));

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-7 w-7 text-emerald-500" /> נדל"ן</h1>
          <p className="text-sm text-gray-500 mt-1">ניהול ומעקב אחרי נכסים</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 me-1" /> הוספת נכס</Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">שווי כולל</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.totalCurrentValue)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">הכנסה חודשית משכ"ד</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(summary.totalMonthlyRent)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">הוצאות חודשיות</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalMonthlyExpenses)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">עליית ערך כוללת</p>
            <p className={`text-xl font-bold ${summary.totalAppreciation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalAppreciation)}
            </p>
          </CardContent></Card>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Chart */}
        {properties.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">התפלגות שווי</CardTitle></CardHeader>
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

        {/* Properties List */}
        <div className={`space-y-3 ${properties.length > 0 ? 'md:col-span-2' : 'md:col-span-3'}`}>
          {properties.length === 0 && <Card><CardContent className="py-12 text-center text-gray-500">אין נכסים. הוסף את הנכס הראשון!</CardContent></Card>}
          {properties.map(p => (
            <Card key={p._id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Home className="h-4 w-4 text-emerald-500" />
                      <h3 className="font-bold">{p.name}</h3>
                      <Badge variant="secondary" className="text-xs">{PROPERTY_TYPES[p.propertyType]}</Badge>
                      <Badge variant={p.usageType === 'investment' ? 'default' : 'outline'} className="text-xs">{USAGE_TYPES[p.usageType]}</Badge>
                    </div>
                    {p.address && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{p.address}</p>}
                    <div className="flex gap-4 mt-2 text-sm">
                      <span>שווי: <b className="text-emerald-600">{formatCurrency(p.currentValue || p.purchasePrice)}</b></span>
                      {p.purchasePrice && <span>רכישה: {formatCurrency(p.purchasePrice)}</span>}
                      {p.appreciation != null && (
                        <span className={p.appreciation >= 0 ? 'text-green-600' : 'text-red-600'}>
                          <TrendingUp className="h-3 w-3 inline me-1" />
                          {p.appreciation >= 0 ? '+' : ''}{formatCurrency(p.appreciation)} ({formatPercent(p.appreciationPercent)})
                        </span>
                      )}
                    </div>
                    {p.usageType === 'investment' && p.monthlyRent > 0 && (
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className="text-blue-600"><DollarSign className="h-3 w-3 inline" /> שכ"ד: {formatCurrency(p.monthlyRent)}/חודש</span>
                        {p.annualYield != null && <span className="text-purple-600">תשואה: {formatPercent(p.annualYield)}</span>}
                        {p.tenantName && <span className="text-gray-500">שוכר: {p.tenantName}</span>}
                      </div>
                    )}
                    {(p.size || p.rooms) && <p className="text-xs text-gray-400 mt-1">{p.size ? `${p.size} מ"ר` : ''} {p.rooms ? `• ${p.rooms} חדרים` : ''}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(p._id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'עריכת נכס' : 'הוספת נכס'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="שם הנכס *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <Input placeholder="כתובת" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.propertyType} onValueChange={v => setForm({...form, propertyType: v})}>
                <SelectTrigger><SelectValue placeholder="סוג נכס" /></SelectTrigger>
                <SelectContent>{Object.entries(PROPERTY_TYPES).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.usageType} onValueChange={v => setForm({...form, usageType: v})}>
                <SelectTrigger><SelectValue placeholder="שימוש" /></SelectTrigger>
                <SelectContent>{Object.entries(USAGE_TYPES).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="מחיר רכישה" value={form.purchasePrice} onChange={e => setForm({...form, purchasePrice: e.target.value})} />
              <Input type="date" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate: e.target.value})} />
            </div>
            <Input type="number" placeholder="שווי נוכחי" value={form.currentValue} onChange={e => setForm({...form, currentValue: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder='גודל (מ"ר)' value={form.size} onChange={e => setForm({...form, size: e.target.value})} />
              <Input type="number" placeholder="מספר חדרים" value={form.rooms} onChange={e => setForm({...form, rooms: e.target.value})} />
            </div>
            <h4 className="font-medium text-sm pt-2 border-t">השכרה</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="שכירות חודשית" value={form.monthlyRent} onChange={e => setForm({...form, monthlyRent: e.target.value})} />
              <Input placeholder="שם שוכר" value={form.tenantName} onChange={e => setForm({...form, tenantName: e.target.value})} />
            </div>
            <Input type="date" value={form.leaseEndDate} onChange={e => setForm({...form, leaseEndDate: e.target.value})} />
            <h4 className="font-medium text-sm pt-2 border-t">הוצאות חודשיות</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="תחזוקה/ועד בית" value={form.maintenanceCost} onChange={e => setForm({...form, maintenanceCost: e.target.value})} />
              <Input type="number" placeholder="ארנונה" value={form.arnonaCost} onChange={e => setForm({...form, arnonaCost: e.target.value})} />
              <Input type="number" placeholder="ביטוח" value={form.insuranceCost} onChange={e => setForm({...form, insuranceCost: e.target.value})} />
              <Input type="number" placeholder="אחר" value={form.otherExpenses} onChange={e => setForm({...form, otherExpenses: e.target.value})} />
            </div>
            {mortgages.length > 0 && (
              <>
                <h4 className="font-medium text-sm pt-2 border-t">משכנתא מקושרת</h4>
                <Select value={form.linkedMortgage} onValueChange={v => setForm({...form, linkedMortgage: v})}>
                  <SelectTrigger><SelectValue placeholder="בחר משכנתא" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא</SelectItem>
                    {mortgages.map(m => <SelectItem key={m._id} value={m._id}>{m.propertyAddress || m.bank || 'משכנתא'}</SelectItem>)}
                  </SelectContent>
                </Select>
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
