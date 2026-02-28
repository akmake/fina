import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Globe, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Coins } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import toast from 'react-hot-toast';

const CURRENCIES = { USD: 'דולר $', EUR: 'אירו €', GBP: 'ליש"ט £', CHF: 'פרנק שוויצרי', JPY: 'ין ¥', CAD: 'דולר קנדי', AUD: 'דולר אוסטרלי', BTC: 'ביטקוין ₿', ETH: 'את\'ריום', OTHER: 'אחר' };
const HOLDING_TYPES = { bank_account: 'חשבון בנק', cash: 'מזומן', digital_wallet: 'ארנק דיגיטלי', crypto: 'קריפטו', other: 'אחר' };
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

const emptyForm = { name:'', currency:'USD', amountInCurrency:'', purchaseRate:'', exchangeRate:'', type:'bank_account', institution:'', notes:'' };

export default function ForeignCurrencyPage() {
  const [holdings, setHoldings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [byCurrencyData, setByCurrencyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const { data } = await api.get('/foreign-currency');
      setHoldings(data.holdings || []);
      setSummary(data.summary || null);
      setByCurrencyData(data.byCurrency || []);
    } catch { toast.error('שגיאה בטעינה'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (h) => {
    setEditing(h._id);
    setForm({
      name: h.name||'', currency: h.currency, amountInCurrency: h.amountInCurrency||'', purchaseRate: h.purchaseRate||'',
      exchangeRate: h.exchangeRate||'', type: h.type, institution: h.institution||'', notes: h.notes||'',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error('שם חובה');
    if (!form.amountInCurrency) return toast.error('כמות חובה');
    try {
      const body = { ...form, amountInCurrency: Number(form.amountInCurrency)||0, purchaseRate: Number(form.purchaseRate)||0, exchangeRate: Number(form.exchangeRate)||0 };
      if (editing) await api.put(`/foreign-currency/${editing}`, body);
      else await api.post('/foreign-currency', body);
      toast.success(editing ? 'עודכן' : 'נוסף');
      setDialogOpen(false); load();
    } catch { toast.error('שגיאה בשמירה'); }
  };

  const remove = async (id) => {
    if (!confirm('למחוק?')) return;
    try { await api.delete(`/foreign-currency/${id}`); toast.success('נמחק'); load(); } catch { toast.error('שגיאה'); }
  };

  const fetchExchangeRate = async (currency) => {
    if (!currency || currency === 'OTHER') return;
    const toastId = toast.loading('מושך שער עדכני...');
    try {
      const { data } = await api.get(`/foreign-currency/rates?currencies=${currency}`);
      const rate = data.rates?.[currency];
      if (rate) {
        setForm(prev => ({ ...prev, exchangeRate: rate.toFixed(4) }));
        const ageMin = Math.round((Date.now() - data.cachedAt) / 60000);
        const cacheMsg = ageMin < 1 ? 'טרי' : `מלפני ${ageMin} דקות`;
        toast.success(`שער ${currency}: ₪${rate.toFixed(2)} (${cacheMsg})`, { id: toastId });
      } else {
        toast.error('לא נמצא שער למטבע', { id: toastId });
      }
    } catch {
      toast.error('שגיאה במשיכת השער. נא להזין ידנית.', { id: toastId });
    }
  };

  // Group by currency for chart
  const pieData = byCurrencyData.map(g => ({ name: CURRENCIES[g.currency] || g.currency, value: g.totalInILS }));
  const barData = byCurrencyData.map(g => ({
    name: g.currency,
    profit: (g.holdings || []).reduce((s, h) => s + (h.profitLoss || 0), 0),
  }));

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="h-7 w-7 text-indigo-500" /> מט"ח</h1>
          <p className="text-sm text-gray-500 mt-1">ניהול אחזקות מטבע חוץ וקריפטו</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 me-1" /> הוספת אחזקה</Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-indigo-50 dark:bg-indigo-950 border-indigo-200"><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">שווי כולל (₪)</p>
            <p className="text-xl font-bold text-indigo-600">{formatCurrency(summary.totalValueILS)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">רווח/הפסד כולל</p>
            <p className={`text-xl font-bold ${(summary.totalProfitLoss||0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalProfitLoss)}
            </p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">מספר מטבעות</p>
            <p className="text-xl font-bold">{byCurrencyData.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">מספר אחזקות</p>
            <p className="text-xl font-bold">{holdings.length}</p>
          </CardContent></Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">התפלגות לפי מטבע (₪)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
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

        {/* Profit/Loss Bar */}
        {barData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">רווח/הפסד לפי מטבע</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Bar dataKey="profit" name="רווח/הפסד" radius={[4,4,0,0]}>
                    {barData.map((e, i) => <Cell key={i} fill={e.profit >= 0 ? '#10b981' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Holdings List */}
      <div className="space-y-2">
        {holdings.length === 0 && <Card><CardContent className="py-12 text-center text-gray-500">אין אחזקות מט"ח. הוסף את הראשונה!</CardContent></Card>}
        {holdings.map(h => (
          <Card key={h._id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="h-4 w-4 text-indigo-500" />
                    <span className="font-bold">{h.name || `${h.amountInCurrency?.toLocaleString()} ${h.currency}`}</span>
                    <Badge variant="secondary" className="text-xs">{HOLDING_TYPES[h.type]}</Badge>
                    {h.institution && <span className="text-xs text-gray-500">{h.institution}</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{h.amountInCurrency?.toLocaleString()} {h.currency}</span>
                    {h.purchaseRate > 0 && <span>שער קניה: ₪{h.purchaseRate}</span>}
                    {h.exchangeRate > 0 && <span>שער נוכחי: ₪{h.exchangeRate}</span>}
                    {h.amountInILS > 0 && <span>שווי: {formatCurrency(h.amountInILS)}</span>}
                    {h.profitLoss != null && h.profitLoss !== 0 && (
                      <span className={`flex items-center gap-1 ${h.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {h.profitLoss >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatCurrency(Math.abs(h.profitLoss))} ({h.profitLossPercent >= 0 ? '+' : ''}{h.profitLossPercent?.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(h)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(h._id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'עריכת אחזקה' : 'הוספת אחזקה'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                <SelectTrigger><SelectValue placeholder="מטבע" /></SelectTrigger>
                <SelectContent>{Object.entries(CURRENCIES).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                <SelectTrigger><SelectValue placeholder="סוג" /></SelectTrigger>
                <SelectContent>{Object.entries(HOLDING_TYPES).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="שם האחזקה *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <Input type="number" placeholder="כמות *" value={form.amountInCurrency} onChange={e => setForm({...form, amountInCurrency: e.target.value})} />
            
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" step="0.01" placeholder="שער קנייה (₪)" value={form.purchaseRate} onChange={e => setForm({...form, purchaseRate: e.target.value})} />
              
              {/* --- תיקון: כפתור שאיבת שער מט"ח מהאינטרנט --- */}
              <div className="flex gap-2 relative group">
                <Input type="number" step="0.01" placeholder="שער נוכחי (₪)" value={form.exchangeRate} onChange={e => setForm({...form, exchangeRate: e.target.value})} />
                <Button type="button" variant="outline" size="icon" onClick={() => fetchExchangeRate(form.currency)} title="משוך שער אוטומטית">
                  <Globe className="h-4 w-4 text-blue-500" />
                </Button>
              </div>
            </div>
            
            <Input placeholder="בנק / מוסד" value={form.institution} onChange={e => setForm({...form, institution: e.target.value})} />
            <Input placeholder="הערות" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={save}>שמירה</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}