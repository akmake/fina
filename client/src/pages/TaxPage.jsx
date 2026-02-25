import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, ShieldCheck, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import toast from 'react-hot-toast';

const BRACKET_COLORS = ['#10b981','#22c55e','#84cc16','#f59e0b','#f97316','#ef4444','#dc2626'];

export default function TaxPage() {
  const [brackets, setBrackets] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [form, setForm] = useState({
    monthlyGross: '',
    employmentType: 'employee',
    creditPoints: ['resident'],
    pensionDeposit: '',
    educationFund: '',
    donations: '',
  });

  useEffect(() => {
    api.get('/tax/brackets').then(r => setBrackets(r.data)).catch(() => {});
  }, []);

  const calculate = async () => {
    if (!form.monthlyGross) return toast.error('הכנס שכר ברוטו');
    setLoading(true);
    try {
      const { data } = await api.post('/tax/calculate', {
        ...form,
        monthlyGross: Number(form.monthlyGross),
        pensionDeposit: Number(form.pensionDeposit) || 0,
        educationFund: Number(form.educationFund) || 0,
        donations: Number(form.donations) || 0,
      });
      setResult(data);
    } catch { toast.error('שגיאה בחישוב'); }
    setLoading(false);
  };

  const toggleCredit = (key) => {
    setForm(f => ({
      ...f,
      creditPoints: f.creditPoints.includes(key)
        ? f.creditPoints.filter(k => k !== key)
        : [...f.creditPoints, key],
    }));
  };

  const bracketChartData = brackets?.taxBrackets?.map((b, i) => ({
    name: b.to === Infinity ? `${(b.from/1000).toFixed(0)}K+` : `${(b.from/1000).toFixed(0)}-${(b.to/1000).toFixed(0)}K`,
    rate: b.rate,
    color: BRACKET_COLORS[i],
  })) || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Calculator className="h-7 w-7 text-blue-500" /> מחשבון מס הכנסה</h1>
        <p className="text-sm text-gray-500 mt-1">חישוב מס הכנסה, ביטוח לאומי ומס בריאות — מדרגות 2025/2026</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input */}
        <Card>
          <CardHeader><CardTitle className="text-lg">נתוני הכנסה</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">שכר ברוטו חודשי *</label>
              <Input type="number" value={form.monthlyGross} onChange={e => setForm({...form, monthlyGross: e.target.value})} placeholder="15,000" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">סטטוס תעסוקה</label>
              <Select value={form.employmentType} onValueChange={v => setForm({...form, employmentType: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">שכיר</SelectItem>
                  <SelectItem value="self_employed">עצמאי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">הפקדה לפנסיה (חודשי)</label>
              <Input type="number" value={form.pensionDeposit} onChange={e => setForm({...form, pensionDeposit: e.target.value})} placeholder="0" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">הפקדה לקרן השתלמות (חודשי)</label>
              <Input type="number" value={form.educationFund} onChange={e => setForm({...form, educationFund: e.target.value})} placeholder="0" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">תרומות שנתיות</label>
              <Input type="number" value={form.donations} onChange={e => setForm({...form, donations: e.target.value})} placeholder="0" className="mt-1" />
            </div>

            {/* Credit Points */}
            <div>
              <label className="text-sm font-medium mb-2 block">נקודות זיכוי</label>
              <div className="flex flex-wrap gap-2">
                {brackets?.creditPointOptions && Object.entries(brackets.creditPointOptions).map(([key, cp]) => (
                  <Badge
                    key={key}
                    variant={form.creditPoints.includes(key) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleCredit(key)}
                  >
                    {cp.label} ({cp.points})
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={calculate} disabled={loading} className="w-full">
              {loading ? 'מחשב...' : 'חשב מס'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Main Result */}
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950 border-blue-200">
                <CardContent className="pt-6 text-center">
                  <p className="text-sm text-gray-500">נטו חודשי</p>
                  <p className="text-4xl font-bold text-blue-600 mt-1">{formatCurrency(result.totals.monthlyNet)}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    שיעור מס אפקטיבי: <span className="font-bold text-red-500">{result.totals.effectiveTaxRate}%</span>
                    {' • '}
                    מס שולי: <span className="font-bold text-red-500">{result.totals.marginalTaxRate}%</span>
                  </p>
                </CardContent>
              </Card>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-gray-500">מס הכנסה</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(result.incomeTax.finalMonthly)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-gray-500">ביטוח לאומי</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(result.nationalInsurance.monthly)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-gray-500">מס בריאות</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(result.healthTax.monthly)}</p>
                </CardContent></Card>
              </div>

              {/* Detailed Breakdown */}
              <Button variant="ghost" onClick={() => setShowDetails(!showDetails)} className="w-full text-sm">
                {showDetails ? <ChevronUp className="h-4 w-4 me-1" /> : <ChevronDown className="h-4 w-4 me-1" />}
                פירוט מלא
              </Button>

              {showDetails && (
                <Card>
                  <CardContent className="pt-4 space-y-3 text-sm">
                    <div className="flex justify-between border-b pb-2"><span>ברוטו שנתי</span><span className="font-bold">{formatCurrency(result.input.annualGross)}</span></div>
                    <div className="flex justify-between"><span>מס הכנסה גולמי</span><span>{formatCurrency(result.incomeTax.grossTax)}</span></div>
                    <div className="flex justify-between text-green-600"><span>נקודות זיכוי ({result.incomeTax.creditPointsUsed})</span><span>-{formatCurrency(result.incomeTax.creditValue)}</span></div>
                    {result.incomeTax.donationCredit > 0 && <div className="flex justify-between text-green-600"><span>זיכוי תרומות</span><span>-{formatCurrency(result.incomeTax.donationCredit)}</span></div>}
                    {result.incomeTax.pensionDeduction > 0 && <div className="flex justify-between text-green-600"><span>ניכוי פנסיוני</span><span>-{formatCurrency(result.incomeTax.pensionDeduction)}</span></div>}
                    <div className="flex justify-between border-t pt-2 font-bold"><span>מס הכנסה סופי (שנתי)</span><span className="text-red-600">{formatCurrency(result.incomeTax.finalAnnual)}</span></div>
                    <div className="flex justify-between"><span>ביטוח לאומי (שנתי)</span><span className="text-red-600">{formatCurrency(result.nationalInsurance.annual)}</span></div>
                    <div className="flex justify-between"><span>מס בריאות (שנתי)</span><span className="text-red-600">{formatCurrency(result.healthTax.annual)}</span></div>
                    <div className="flex justify-between border-t pt-2 font-bold text-lg"><span>סה"כ מס שנתי</span><span className="text-red-600">{formatCurrency(result.totals.totalAnnualTax)}</span></div>
                    <div className="flex justify-between font-bold text-lg"><span>נטו שנתי</span><span className="text-green-600">{formatCurrency(result.totals.annualNet)}</span></div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* Tax Brackets Chart */
            <Card>
              <CardHeader><CardTitle className="text-lg">מדרגות מס הכנסה</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={bracketChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis unit="%" fontSize={11} />
                    <Tooltip formatter={v => `${v}%`} />
                    <Bar dataKey="rate" radius={[4,4,0,0]}>
                      {bracketChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
