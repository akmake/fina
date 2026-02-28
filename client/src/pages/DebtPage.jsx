import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreditCard, TrendingDown, Zap, Snowflake, ArrowDown, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import toast from 'react-hot-toast';

export default function DebtPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const [extraPayment, setExtraPayment] = useState('500');
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [strategy, setStrategy] = useState('avalanche');

  const load = async () => {
    try {
      const { data: d } = await api.get('/debts');
      setData(d);
    } catch { toast.error('שגיאה בטעינה'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const simulate = async () => {
    setSimLoading(true);
    try {
      const { data: d } = await api.post('/debts/simulate', {
        debts: (data?.debts || []).map(d => ({ name: d.name, balance: d.balance, interestRate: d.interestRate, monthlyPayment: d.monthlyPayment })),
        extraMonthly: Number(extraPayment) || 0,
        strategy,
      });
      setSimResult(d);
    } catch { toast.error('שגיאה בסימולציה'); }
    setSimLoading(false);
  };

  const debtList = strategy === 'avalanche' ? data?.avalancheOrder : data?.snowballOrder;
  const strategyLabel = strategy === 'avalanche' ? 'מפולת (ריבית גבוהה קודם)' : 'כדור שלג (יתרה נמוכה קודם)';

  const barData = debtList?.map(d => ({
    name: d.name?.substring(0, 15) || 'חוב',
    balance: d.balance,
    rate: d.interestRate,
  })) || [];

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-7 w-7 text-red-500" /> ניהול חובות</h1>
        <p className="text-sm text-gray-500 mt-1">סקירת כל החובות ואסטרטגיית פירעון</p>
      </div>

      {!data || data.debts?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">אין חובות פעילים — מצוין! 🎉</CardContent></Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-red-50 dark:bg-red-950 border-red-200"><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">סה"כ חובות</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(data.summary?.totalDebt)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">תשלום חודשי</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(data.summary?.totalMonthlyPayments)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">ריבית ממוצעת</p>
              <p className="text-xl font-bold text-purple-600">
                {(() => { const debts = data.debts || []; const totalBal = debts.reduce((s, d) => s + d.balance, 0); return totalBal > 0 ? (debts.reduce((s, d) => s + d.interestRate * d.balance, 0) / totalBal).toFixed(1) + '%' : '0%'; })()}
              </p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-gray-500">מספר חובות</p>
              <p className="text-xl font-bold">{data.summary?.debtCount || 0}</p>
            </CardContent></Card>
          </div>

          {/* Strategy Toggle */}
          <div className="flex gap-2">
            <Button variant={strategy === 'avalanche' ? 'default' : 'outline'} onClick={() => setStrategy('avalanche')} className="gap-1">
              <Zap className="h-4 w-4" /> מפולת (Avalanche)
            </Button>
            <Button variant={strategy === 'snowball' ? 'default' : 'outline'} onClick={() => setStrategy('snowball')} className="gap-1">
              <Snowflake className="h-4 w-4" /> כדור שלג (Snowball)
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Chart */}
            <Card>
              <CardHeader><CardTitle className="text-sm">יתרות חובות לפי {strategyLabel}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v, name) => name === 'balance' ? formatCurrency(v) : `${v}%`} />
                    <Bar dataKey="balance" fill="#ef4444" name="יתרה" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Debt List */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm">סדר פירעון — {strategyLabel}</h3>
              {debtList?.map((d, idx) => (
                <Card key={d.id || idx} className={idx === 0 ? 'border-red-400 bg-red-50/50 dark:bg-red-950/30' : ''}>
                  <CardContent className="py-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          {idx === 0 && <Badge variant="destructive" className="text-xs">לפרוע ראשון</Badge>}
                          <span className="font-medium text-sm">{d.name || 'חוב'}</span>
                          <Badge variant="outline" className="text-xs">{d.type === 'loan' ? 'הלוואה' : d.type === 'mortgage' ? 'משכנתא' : 'מינוס'}</Badge>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500 mt-1">
                          <span>ריבית: {d.interestRate}%</span>
                          {d.monthlyPayment > 0 && <span>חודשי: {formatCurrency(d.monthlyPayment)}</span>}
                        </div>
                      </div>
                      <span className="font-bold text-red-600">{formatCurrency(d.balance)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Simulation */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950 border-blue-200">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingDown className="h-5 w-5" /> סימולציית פירעון מואץ</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end mb-4">
                <div className="flex-1">
                  <label className="text-sm font-medium">תוספת חודשית לפירעון</label>
                  <Input type="number" value={extraPayment} onChange={e => setExtraPayment(e.target.value)} className="mt-1" />
                </div>
                <Button onClick={simulate} disabled={simLoading}>
                  {simLoading ? 'מחשב...' : 'בצע סימולציה'}
                </Button>
              </div>

              {simResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                      <p className="text-xs text-gray-500">חודשים שנחסכו</p>
                      <p className="text-lg font-bold text-green-600">{simResult.savedMonths}</p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                      <p className="text-xs text-gray-500">סיום רגיל</p>
                      <p className="text-lg font-bold text-gray-600">{simResult.baselineMonths} חודשים</p>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                      <p className="text-xs text-gray-500">סיום מואץ</p>
                      <p className="text-lg font-bold text-blue-600">{simResult.monthsToPayoff} חודשים</p>
                    </div>
                  </div>

                  {simResult.timeline?.length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={simResult.timeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={10} />
                        <YAxis fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                        <Tooltip formatter={v => formatCurrency(v)} />
                        <Line type="monotone" dataKey="totalRemaining" stroke="#ef4444" strokeWidth={2} dot={false} name="יתרה" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
