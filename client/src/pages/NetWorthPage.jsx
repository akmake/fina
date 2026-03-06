import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  TrendingUp, Shield, Wallet, PiggyBank, Scale, AlertTriangle,
  CheckCircle, Info, Heart, BarChart3, ArrowUpRight, ArrowDownRight,
  Calculator, Flame,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';

// ─── Rule of 72 Calculator ────────────────────────────────────────────────
const ISRAEL_INFLATION = 3.5; // ממוצע ישראלי שנתי

function RuleOf72Card({ liquidAssets }) {
  const [rate, setRate] = useState(5);
  const years = rate > 0 ? (72 / rate).toFixed(1) : '—';
  const realRate = Math.max(0, rate - ISRAEL_INFLATION);
  const realYears = realRate > 0 ? (72 / realRate).toFixed(1) : '—';
  const inflationLoss1Y = liquidAssets * (ISRAEL_INFLATION / 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calculator className="h-5 w-5 text-indigo-500" />
          כלל 72 — הכפלת הכסף
        </CardTitle>
        <CardDescription>
          בשיעור ריבית X%, הכסף מוכפל בעוד 72/X שנים
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
            ריבית שנתית: <span className="font-bold text-indigo-600">{rate}%</span>
          </label>
          <input
            type="range" min={0.5} max={20} step={0.5} value={rate}
            onChange={e => setRate(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-center">
            <p className="text-xs text-slate-500 mb-1">הכפלה נומינלית</p>
            <p className="text-2xl font-extrabold text-indigo-600">{years}</p>
            <p className="text-xs text-slate-500">שנים</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-center">
            <p className="text-xs text-slate-500 mb-1">הכפלה ריאלית ({ISRAEL_INFLATION}% אינפלציה)</p>
            <p className="text-2xl font-extrabold text-amber-600">{realYears}</p>
            <p className="text-xs text-slate-500">שנים</p>
          </div>
        </div>
        {liquidAssets > 0 && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">שחיקת אינפלציה</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              הנכסים הנזילים שלך ({formatCurrency(liquidAssets)}) מאבדים כ-
              <span className="font-bold text-red-600"> {formatCurrency(inflationLoss1Y)} </span>
              בשנה בערך ריאלי — ודא שהם מרוויחים לפחות {ISRAEL_INFLATION}%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function NetWorthPage() {
  const [netWorthData, setNetWorthData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nwRes, healthRes, historyRes] = await Promise.all([
        api.get('/net-worth'),
        api.get('/net-worth/health-score'),
        api.get('/net-worth/history').catch(() => ({ data: { history: [] } })),
      ]);
      setNetWorthData(nwRes.data);
      setHealthData(healthRes.data);
      setHistory(historyRes.data?.history || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="h-7 w-7 text-blue-600" />
          שווי נקי ובריאות פיננסית
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          תמונה פיננסית כוללת של כל הנכסים וההתחייבויות
        </p>
      </div>

      {netWorthData && (
        <>
          {/* שווי נקי */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6">
            <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0">
              <CardContent className="py-8">
                <div className="text-center">
                  <p className="text-blue-200 text-sm font-medium mb-1">שווי נקי כולל</p>
                  <p className="text-4xl font-extrabold mb-4">{formatCurrency(netWorthData.netWorth)}</p>
                  <div className="flex justify-center gap-8">
                    <div className="text-center">
                      <p className="text-blue-200 text-xs">נכסים</p>
                      <p className="text-xl font-bold flex items-center gap-1">
                        <ArrowUpRight className="h-4 w-4" />{formatCurrency(netWorthData.assets.total)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-blue-200 text-xs">התחייבויות</p>
                      <p className="text-xl font-bold flex items-center gap-1">
                        <ArrowDownRight className="h-4 w-4" />{formatCurrency(netWorthData.liabilities.total)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* פירוט נכסים + גרף */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* גרף התפלגות */}
            <Card>
              <CardHeader><CardTitle className="text-lg">התפלגות נכסים</CardTitle></CardHeader>
              <CardContent>
                {netWorthData.assetBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={netWorthData.assetBreakdown} dataKey="value" nameKey="label"
                        cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                        label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                        {netWorthData.assetBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-slate-400">
                    <p>אין נתונים להצגה</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* פירוט */}
            <Card>
              <CardHeader><CardTitle className="text-lg">פירוט נכסים</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <AssetRow icon={<Wallet className="h-4 w-4" />} label='עו"ש' value={netWorthData.assets.checking} color="text-blue-600" />
                <AssetRow icon={<PiggyBank className="h-4 w-4" />} label="מזומן" value={netWorthData.assets.cash} color="text-green-600" />
                <AssetRow icon={<Shield className="h-4 w-4" />} label={`פיקדונות (${netWorthData.assets.depositsCount})`} value={netWorthData.assets.deposits} color="text-amber-600" />
                <AssetRow icon={<TrendingUp className="h-4 w-4" />} label={`מניות (${netWorthData.assets.stocksCount})`} value={netWorthData.assets.stocks} color="text-purple-600" />
                <AssetRow icon={<BarChart3 className="h-4 w-4" />} label={`קרנות (${netWorthData.assets.fundsCount})`} value={netWorthData.assets.funds} color="text-pink-600" />
                <AssetRow icon={<Heart className="h-4 w-4" />} label={`פנסיוני (${netWorthData.assets.pensionCount})`} value={netWorthData.assets.pension} color="text-cyan-600" />

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">נזילים (עו"ש + מזומן)</span>
                    <span className="font-medium">{formatCurrency(netWorthData.assets.totalLiquid)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">השקעות (מניות + קרנות)</span>
                    <span className="font-medium">{formatCurrency(netWorthData.assets.totalInvestments)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">חסכון (פיקדונות + פנסיוני)</span>
                    <span className="font-medium">{formatCurrency(netWorthData.assets.totalSavings)}</span>
                  </div>
                </div>

                {netWorthData.liabilities.total > 0 && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm font-semibold text-red-600 mb-2">התחייבויות</p>
                    {netWorthData.liabilities.loans > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">הלוואות ({netWorthData.liabilities.loansCount})</span>
                        <span className="text-red-600 font-medium">-{formatCurrency(netWorthData.liabilities.loans)}</span>
                      </div>
                    )}
                    {netWorthData.liabilities.overdraft > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">מסגרת אשראי</span>
                        <span className="text-red-600 font-medium">-{formatCurrency(netWorthData.liabilities.overdraft)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* היסטוריית שווי נקי */}
          {history.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    מגמת שווי נקי — 12 חודשים
                  </CardTitle>
                  <CardDescription>שווי נקי, נכסים והתחייבויות לאורך הזמן</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradNW" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                        </linearGradient>
                        <linearGradient id="gradAssets" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={v => `₪${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={55} />
                      <Tooltip
                        formatter={(v, name) => [formatCurrency(v), name === 'netWorth' ? 'שווי נקי' : name === 'assets' ? 'נכסים' : 'התחייבויות']}
                      />
                      <Legend formatter={v => v === 'netWorth' ? 'שווי נקי' : v === 'assets' ? 'נכסים' : 'התחייבויות'} />
                      <Area type="monotone" dataKey="assets"      stroke="#10b981" strokeWidth={1.5} fill="url(#gradAssets)" dot={false} />
                      <Area type="monotone" dataKey="liabilities" stroke="#ef4444" strokeWidth={1.5} fill="none" dot={false} />
                      <Area type="monotone" dataKey="netWorth"    stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradNW)" dot={{ r: 3, fill: '#3b82f6' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* כלל 72 + אינפלציה */}
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-6">
            <RuleOf72Card liquidAssets={netWorthData.assets?.totalLiquid || 0} />
          </div>
        </>
      )}

      {/* ציון בריאות פיננסית */}
      {healthData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" /> ציון בריאות פיננסית
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* ציון ראשי */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-28 h-28 rounded-full border-4 mb-3"
                  style={{ borderColor: healthData.gradeColor }}>
                  <div>
                    <p className="text-3xl font-extrabold" style={{ color: healthData.gradeColor }}>{healthData.totalScore}</p>
                    <p className="text-xs text-slate-500">מתוך {healthData.maxPossible}</p>
                  </div>
                </div>
                <div>
                  <Badge className="text-sm px-3 py-1" style={{ backgroundColor: healthData.gradeColor, color: 'white' }}>
                    {healthData.grade} – {healthData.gradeLabel}
                  </Badge>
                </div>
              </div>

              {/* פירוט ציונים */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {healthData.scores.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 * i }}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{s.category}</span>
                      <span className="text-sm font-bold">{s.score}/{s.maxScore}</span>
                    </div>
                    <Progress value={(s.score / s.maxScore) * 100} className="h-2" />
                    <p className="text-xs text-slate-500 mt-1">{s.detail}</p>
                  </motion.div>
                ))}
              </div>

              {/* טיפים */}
              {healthData.tips.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">טיפים לשיפור</h4>
                  <div className="space-y-2">
                    {healthData.tips.map((tip, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          tip.priority === 'high' ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800' :
                          tip.priority === 'medium' ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800' :
                          'border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                        }`}>
                        <span className="text-lg">{tip.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm text-slate-700 dark:text-slate-300">{tip.tip}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {tip.priority === 'high' ? 'חשוב' : tip.priority === 'medium' ? 'מומלץ' : 'רשות'}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function AssetRow({ icon, label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <span className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(value)}</span>
    </div>
  );
}
