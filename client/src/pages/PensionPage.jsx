import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, Edit, Building2, GraduationCap, Shield, PiggyBank,
  TrendingUp, Calculator, AlertCircle, DollarSign, Landmark
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import toast from 'react-hot-toast';

const PRODUCT_TYPES = {
  pension: { label: 'קרן פנסיה', icon: Building2, color: '#3b82f6', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  education_fund: { label: 'קרן השתלמות', icon: GraduationCap, color: '#10b981', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  provident_fund: { label: 'קופת גמל', icon: PiggyBank, color: '#f59e0b', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  managers_insurance: { label: 'ביטוח מנהלים', icon: Shield, color: '#8b5cf6', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  savings_policy: { label: 'פוליסת חיסכון', icon: DollarSign, color: '#ec4899', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
};

const COMPANIES = ['מגדל', 'הראל', 'כלל', 'הפניקס', 'מנורה מבטחים', 'מיטב דש', 'אלטשולר שחם', 'אנליסט', 'פסגות', 'מור', 'ילין לפידות', 'אחר'];

export default function PensionPage() {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [simForm, setSimForm] = useState({ age: 30, retirementAge: 67, expectedReturn: 4 });

  const [form, setForm] = useState({
    productType: 'pension', name: '', policyNumber: '', company: '',
    track: '', monthlyEmployeeContribution: '', monthlyEmployerContribution: '',
    monthlySeveranceContribution: '', currentBalance: '', totalDeposited: '',
    lastYearReturn: '', managementFeeDeposits: '', managementFeeBalance: '',
    startDate: '', grossSalary: '', notes: '',
  });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/pension');
      setProducts(data.products);
      setSummary(data.summary);
      setTotals(data.totals);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const saveProduct = async () => {
    if (!form.productType || !form.name || !form.startDate) {
      toast.error('סוג מוצר, שם ותאריך התחלה הם שדות חובה');
      return;
    }
    try {
      const payload = {
        ...form,
        monthlyEmployeeContribution: Number(form.monthlyEmployeeContribution) || 0,
        monthlyEmployerContribution: Number(form.monthlyEmployerContribution) || 0,
        monthlySeveranceContribution: Number(form.monthlySeveranceContribution) || 0,
        currentBalance: Number(form.currentBalance) || 0,
        totalDeposited: Number(form.totalDeposited) || 0,
        lastYearReturn: Number(form.lastYearReturn) || 0,
        managementFeeDeposits: Number(form.managementFeeDeposits) || 0,
        managementFeeBalance: Number(form.managementFeeBalance) || 0,
        grossSalary: Number(form.grossSalary) || 0,
      };

      if (editingId) {
        await api.put(`/pension/${editingId}`, payload);
        toast.success('המוצר עודכן בהצלחה');
      } else {
        await api.post('/pension', payload);
        toast.success('המוצר נוסף בהצלחה');
      }
      setShowDialog(false);
      setEditingId(null);
      resetForm();
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בשמירה');
    }
  };

  const deleteProduct = async (id) => {
    try {
      await api.delete(`/pension/${id}`);
      toast.success('נמחק בהצלחה');
      fetchProducts();
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  const editProduct = (p) => {
    setForm({
      productType: p.productType, name: p.name, policyNumber: p.policyNumber || '',
      company: p.company || '', track: p.track || '',
      monthlyEmployeeContribution: p.monthlyEmployeeContribution?.toString() || '',
      monthlyEmployerContribution: p.monthlyEmployerContribution?.toString() || '',
      monthlySeveranceContribution: p.monthlySeveranceContribution?.toString() || '',
      currentBalance: p.currentBalance?.toString() || '',
      totalDeposited: p.totalDeposited?.toString() || '',
      lastYearReturn: p.lastYearReturn?.toString() || '',
      managementFeeDeposits: p.managementFeeDeposits?.toString() || '',
      managementFeeBalance: p.managementFeeBalance?.toString() || '',
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      grossSalary: p.grossSalary?.toString() || '',
      notes: p.notes || '',
    });
    setEditingId(p._id);
    setShowDialog(true);
  };

  const resetForm = () => {
    setForm({
      productType: 'pension', name: '', policyNumber: '', company: '',
      track: '', monthlyEmployeeContribution: '', monthlyEmployerContribution: '',
      monthlySeveranceContribution: '', currentBalance: '', totalDeposited: '',
      lastYearReturn: '', managementFeeDeposits: '', managementFeeBalance: '',
      startDate: '', grossSalary: '', notes: '',
    });
  };

  const loadSimulation = async () => {
    try {
      const { data } = await api.get(`/pension/retirement-simulation?age=${simForm.age}&retirementAge=${simForm.retirementAge}&expectedReturn=${simForm.expectedReturn}`);
      setSimulation(data);
      setShowSimulation(true);
    } catch (err) {
      toast.error('שגיאה בחישוב סימולציה');
    }
  };

  // נתונים לגרף
  const pieData = Object.entries(summary).map(([key, val]) => ({
    name: val.label,
    value: val.totalBalance,
    color: PRODUCT_TYPES[key]?.color || '#94a3b8',
  })).filter(d => d.value > 0);

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
            <Landmark className="h-7 w-7 text-blue-600" />
            חסכון פנסיוני
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            פנסיה, קרן השתלמות, קופות גמל וביטוחי מנהלים
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSimulation}>
            <Calculator className="h-4 w-4 me-2" /> סימולציית פרישה
          </Button>
          <Button onClick={() => { resetForm(); setEditingId(null); setShowDialog(true); }}>
            <Plus className="h-4 w-4 me-2" /> הוסף מוצר
          </Button>
        </div>
      </div>

      {/* כרטיסי סיכום */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">סה"כ יתרה פנסיונית</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.totalBalance || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">{totals.productCount || 0} מוצרים</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">הפקדה חודשית</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalMonthlyContribs || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">{formatCurrency(totals.totalAnnualContribs || 0)} / שנה</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">עלות דמי ניהול שנתית</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totals.totalAnnualManagementCost || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">מוצרים פעילים</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{totals.productCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* גרף התפלגות */}
      {pieData.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">התפלגות לפי סוג מוצר</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* טאבים לפי סוג מוצר */}
      <Tabs defaultValue="all" className="mb-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">הכל</TabsTrigger>
          {Object.entries(PRODUCT_TYPES).map(([key, val]) => (
            <TabsTrigger key={key} value={key}>{val.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <ProductGrid products={products} onEdit={editProduct} onDelete={deleteProduct} />
        </TabsContent>
        {Object.keys(PRODUCT_TYPES).map(key => (
          <TabsContent key={key} value={key}>
            <ProductGrid products={products.filter(p => p.productType === key)} onEdit={editProduct} onDelete={deleteProduct} />
          </TabsContent>
        ))}
      </Tabs>

      {/* דיאלוג הוספה/עריכה */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'עריכת מוצר' : 'הוספת מוצר חדש'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">סוג מוצר *</label>
                <Select value={form.productType} onValueChange={v => setForm(f => ({ ...f, productType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_TYPES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">שם הקרן/פוליסה *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="פנסיית ברירת מחדל" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">חברה מנהלת</label>
                <Select value={form.company} onValueChange={v => setForm(f => ({ ...f, company: v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר חברה" /></SelectTrigger>
                  <SelectContent>
                    {COMPANIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">מספר פוליסה</label>
                <Input value={form.policyNumber} onChange={e => setForm(f => ({ ...f, policyNumber: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">תאריך התחלה *</label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>

            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b pb-1">הפקדות חודשיות</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">עובד (₪)</label>
                <Input type="number" value={form.monthlyEmployeeContribution} onChange={e => setForm(f => ({ ...f, monthlyEmployeeContribution: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium">מעסיק (₪)</label>
                <Input type="number" value={form.monthlyEmployerContribution} onChange={e => setForm(f => ({ ...f, monthlyEmployerContribution: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium">פיצויים (₪)</label>
                <Input type="number" value={form.monthlySeveranceContribution} onChange={e => setForm(f => ({ ...f, monthlySeveranceContribution: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b pb-1">יתרות</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">יתרה נוכחית (₪)</label>
                <Input type="number" value={form.currentBalance} onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium">סה"כ הופקד (₪)</label>
                <Input type="number" value={form.totalDeposited} onChange={e => setForm(f => ({ ...f, totalDeposited: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b pb-1">דמי ניהול</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">מהפקדות (%)</label>
                <Input type="number" step="0.01" value={form.managementFeeDeposits} onChange={e => setForm(f => ({ ...f, managementFeeDeposits: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium">מצבירה (%)</label>
                <Input type="number" step="0.01" value={form.managementFeeBalance} onChange={e => setForm(f => ({ ...f, managementFeeBalance: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">תשואה שנתית אחרונה (%)</label>
              <Input type="number" step="0.1" value={form.lastYearReturn} onChange={e => setForm(f => ({ ...f, lastYearReturn: e.target.value }))} placeholder="0" />
            </div>

            <div>
              <label className="text-sm font-medium">שכר ברוטו (₪)</label>
              <Input type="number" value={form.grossSalary} onChange={e => setForm(f => ({ ...f, grossSalary: e.target.value }))} placeholder="לחישוב אחוזי הפרשה" />
            </div>

            <div>
              <label className="text-sm font-medium">הערות</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="הערות..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditingId(null); }}>ביטול</Button>
            <Button onClick={saveProduct}>{editingId ? 'עדכן' : 'הוסף'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* דיאלוג סימולציית פרישה */}
      <Dialog open={showSimulation} onOpenChange={setShowSimulation}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" /> סימולציית פרישה
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">גיל נוכחי</label>
                <Input type="number" value={simForm.age} onChange={e => setSimForm(f => ({ ...f, age: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">גיל פרישה</label>
                <Input type="number" value={simForm.retirementAge} onChange={e => setSimForm(f => ({ ...f, retirementAge: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">תשואה (%)</label>
                <Input type="number" step="0.5" value={simForm.expectedReturn} onChange={e => setSimForm(f => ({ ...f, expectedReturn: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={loadSimulation}>חשב</Button>

            {simulation && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-sm text-slate-500">צבירה צפויה בפרישה</p>
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(simulation.projectedTotal)}</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-sm text-slate-500">קצבה חודשית משוערת</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(simulation.estimatedMonthlyPension)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">יתרה נוכחית</p>
                    <p className="font-medium">{formatCurrency(simulation.currentTotalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">הפקדה חודשית</p>
                    <p className="font-medium">{formatCurrency(simulation.totalMonthlyContrib)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">שנים לפרישה</p>
                    <p className="font-medium">{simulation.yearsToRetirement}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">מוצרים כלולים</p>
                    <p className="font-medium">{simulation.productsIncluded}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  * חישוב משוער בלבד, על בסיס תשואה קבועה של {simulation.expectedReturn}% ומקדם המרה 200
                </p>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── רכיב כרטיסי מוצרים ─────────────────────
function ProductGrid({ products, onEdit, onDelete }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Landmark className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p>לא נמצאו מוצרים</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {products.map((p, i) => {
        const pt = PRODUCT_TYPES[p.productType] || PRODUCT_TYPES.pension;
        const Icon = pt.icon;
        const profitLoss = (p.currentBalance || 0) - (p.totalDeposited || 0);
        const profitPct = p.totalDeposited > 0 ? ((profitLoss / p.totalDeposited) * 100) : 0;

        return (
          <motion.div key={p._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${pt.bgColor}`}>
                      <Icon className="h-5 w-5" style={{ color: pt.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{pt.label}</Badge>
                        {p.company && <span className="text-xs text-slate-500">{p.company}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => onDelete(p._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">יתרה נוכחית</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(p.currentBalance || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">הפקדה חודשית</span>
                    <span className="font-medium text-green-600">{formatCurrency(p.totalMonthlyContribution || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">רווח/הפסד</span>
                    <span className={`font-medium ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)} ({profitPct.toFixed(1)}%)
                    </span>
                  </div>
                  {p.managementFeeBalance > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">דמי ניהול</span>
                      <span className="text-amber-600">{p.managementFeeDeposits}% הפקדות / {p.managementFeeBalance}% צבירה</span>
                    </div>
                  )}
                  {p.lastYearReturn !== 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">תשואה שנתית</span>
                      <span className={`font-medium ${p.lastYearReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {p.lastYearReturn}%
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
