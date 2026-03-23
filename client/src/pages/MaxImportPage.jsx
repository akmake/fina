import React, { useState } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, CreditCard, FileSpreadsheet, Smartphone, Phone } from 'lucide-react';

function getDefaultStartDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('he-IL');
}

function formatAmount(amount, currency) {
  if (amount == null) return '-';
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₪';
  return `${Math.abs(amount).toLocaleString('he-IL')} ${symbol}`;
}

export default function MaxImportPage() {
  const [idNumber, setIdNumber]     = useState('');
  const [startDate, setStartDate]   = useState(getDefaultStartDate());
  const [otp, setOtp]               = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');

  const [stage, setStage]   = useState('credentials'); // credentials | otp | loading | results
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [accounts, setAccounts] = useState(null);

  // ── שלב 1: בקשת קוד ─────────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/max/request-otp', { id: idNumber });
      setMaskedPhone(data.maskedPhone || '');
      setStage('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשליחת הקוד');
    } finally {
      setLoading(false);
    }
  };

  // ── שלב 2: אימות קוד + שליפת עסקאות ─────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setStage('loading');
    setError('');
    try {
      const { data } = await api.post('/max/verify-otp', { id: idNumber, otp, startDate });
      setAccounts(data.accounts || []);
      setStage('results');
    } catch (err) {
      setError(err.response?.data?.message || 'קוד שגוי או פג תוקף');
      setStage('otp');
    }
  };

  const totalTxns = accounts ? accounts.reduce((s, a) => s + a.txns.length, 0) : 0;

  const reset = () => {
    setStage('credentials');
    setError('');
    setAccounts(null);
    setOtp('');
    setMaskedPhone('');
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl" dir="rtl">
      <Card className="shadow-lg">
        <CardHeader className="text-center border-b pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <CreditCard className="h-8 w-8 text-teal-600" />
            <CardTitle className="text-3xl font-bold">ייבוא ממקס</CardTitle>
          </div>
          <CardDescription className="text-base text-slate-600">
            כניסה עם תעודת זהות וקוד חד-פעמי לנייד
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8">

          {/* ── שלב 1: תעודת זהות ── */}
          {stage === 'credentials' && (
            <form onSubmit={handleRequestOtp} className="max-w-sm mx-auto space-y-4">

              {/* כרטיסיות כניסה (ויזואלי בלבד, כמו מקס) */}
              <div className="flex border-b mb-6">
                <div className="flex-1 text-center pb-3 text-sm font-semibold border-b-2 border-teal-600 text-teal-700">
                  כניסה עם תעודת זהות
                </div>
                <div className="flex-1 text-center pb-3 text-sm text-slate-400">
                  כניסה עם סיסמה
                </div>
              </div>

              <p className="text-sm text-slate-500 text-center -mt-2 mb-4">
                נכנסים לאזור האישי עם קוד חד פעמי שמקבלים לנייד
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  מספר תעודת זהות או דרכון
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={idNumber}
                  onChange={e => setIdNumber(e.target.value.replace(/\D/g, ''))}
                  maxLength={9}
                  required
                  placeholder="000000000"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">מאיזה תאריך</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-md border">
                <Phone className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                <span>לנייד "כשר" הקוד יגיע בשיחת טלפון</span>
              </div>

              <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-md border text-center">
                הפרטים משמשים רק לכניסה ולא נשמרים
              </p>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={loading || idNumber.length < 8}
              >
                {loading
                  ? <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  : <Smartphone className="ml-2 h-4 w-4" />}
                שלחו לי קוד לנייד
              </Button>
            </form>
          )}

          {/* ── שלב 2: הזנת קוד ── */}
          {stage === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="max-w-sm mx-auto space-y-4">
              <div className="text-center p-4 bg-teal-50 rounded-lg border border-teal-200">
                <p className="text-sm text-slate-600">שלחנו לך קוד למספר:</p>
                <p className="text-lg font-bold text-slate-800 mt-1">{maskedPhone || '05X-XXXXXX'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  הקוד שקיבלת
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  required
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={otp.length < 4}
              >
                כניסה וייבוא עסקאות
              </Button>
              <button
                type="button"
                onClick={() => setStage('credentials')}
                className="w-full text-sm text-slate-400 hover:text-slate-600 text-center"
              >
                חזור
              </button>
            </form>
          )}

          {/* ── שלב 3: טעינה ── */}
          {stage === 'loading' && (
            <div className="text-center py-16 space-y-4">
              <Loader2 className="mx-auto h-16 w-16 text-teal-500 animate-spin" />
              <p className="text-xl font-semibold">מתחבר למקס ושולף עסקאות...</p>
              <p className="text-slate-400 text-sm">שולף מכל הכרטיסים</p>
            </div>
          )}

          {/* ── שלב 4: תוצאות ── */}
          {stage === 'results' && accounts && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div>
                  <p className="font-semibold text-green-800">
                    נמצאו {totalTxns} עסקאות ב-{accounts.length} כרטיסים
                  </p>
                  <p className="text-sm text-green-600">
                    {accounts.map(a => `${a.cardType || 'כרטיס'} ...${a.accountNumber || '?'} (${a.txns.length})`).join(' | ')}
                  </p>
                </div>
                <Button variant="outline" onClick={reset}>ייבוא חדש</Button>
              </div>

              {accounts.map((acc, ai) => (
                <div key={ai} className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-4 py-3 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      {acc.cardType || 'כרטיס'} ···{acc.accountNumber || '????'}
                    </span>
                    <span className="text-sm text-slate-500">{acc.txns.length} עסקאות</span>
                  </div>
                  {acc.txns.length === 0 ? (
                    <p className="text-center text-slate-400 py-6 text-sm">אין עסקאות בתקופה זו</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">תאריך עסקה</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">תאריך חיוב</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">שם בית העסק</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">סכום</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">סטטוס</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">תשלומים</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acc.txns.map((txn, ti) => {
                            const charged = txn.chargedAmount ?? txn.originalAmount;
                            const isCredit = charged != null && charged > 0;
                            const isPending = txn.status === 'pending';
                            return (
                              <tr key={ti} className={`border-b last:border-0 ${ti % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${isPending ? 'opacity-60' : ''}`}>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(txn.date)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatDate(txn.processedDate)}</td>
                                <td className="px-3 py-2 font-medium max-w-[220px]">
                                  <span className="block truncate" title={txn.description}>{txn.description || txn.memo || '-'}</span>
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap font-mono font-medium ${isCredit ? 'text-green-600' : 'text-slate-800'}`}>
                                  {charged != null ? `${formatAmount(charged, txn.originalCurrency || 'ILS')}${isCredit ? ' ↩' : ''}` : '-'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium
                                    ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                    {isPending ? 'ממתין' : 'הושלם'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-500 text-xs">
                                  {txn.installments ? `${txn.installments.number}/${txn.installments.total}` : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
