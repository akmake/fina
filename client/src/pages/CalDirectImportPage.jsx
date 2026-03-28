import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { requestOtp as calRequestOtp, verifyOtp as calVerifyOtp, fetchTransactions as calFetchTransactions } from '@/utils/calDirectApi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Loader2, AlertTriangle, CreditCard, FileSpreadsheet, Smartphone, MessageCircle, Phone } from 'lucide-react';

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

const OTP_CHANNELS = [
  { value: 'SMS',       label: 'SMS',       icon: Smartphone },
  { value: 'WHATSAPP',  label: 'WhatsApp',  icon: MessageCircle },
  { value: 'VOICE',     label: 'שיחת טלפון', icon: Phone },
];

export default function CalDirectImportPage() {
  // שלב 1 — פרטים
  const [id, setId]             = useState('');
  const [last4, setLast4]       = useState('');
  const [channel, setChannel]   = useState('SMS');
  const [startDate, setStartDate] = useState(getDefaultStartDate());

  // שלב 2 — OTP
  const [otp, setOtp]           = useState('');
  const [uuid, setUuid]         = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');

  // מצב
  const [stage, setStage]       = useState('credentials'); // credentials | otp | loading | results
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // תוצאות
  const [accounts, setAccounts] = useState(null);

  // ── שלב 1: בקשת OTP (ישירות מהדפדפן) ───────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { uuid: newUuid, maskedPhone: phone } = await calRequestOtp({ id, last4 });
      setUuid(newUuid);
      setMaskedPhone(phone);
      setStage('otp');
    } catch (err) {
      setError(err.message || 'שגיאה בשליחת הקוד');
    } finally {
      setLoading(false);
    }
  };

  // ── שלב 2: אימות OTP + שליפת נתונים (ישירות מהדפדפן) ──────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setStage('loading');
    setError('');
    try {
      const authToken = await calVerifyOtp({ id, otp, uuid });
      const accs      = await calFetchTransactions({ authToken, startDate });
      setAccounts(accs);
      setStage('results');
    } catch (err) {
      setError(err.message || 'קוד שגוי או פג תוקף');
      setStage('otp');
    }
  };

  // ── הורדת אקסל ───────────────────────────────────────────────
  const handleDownloadExcel = () => {
    if (!accounts?.length) return;
    const wb = XLSX.utils.book_new();

    // גיליון "כל העסקאות"
    const allRows = accounts.flatMap(acc =>
      acc.txns.map(txn => ({
        'מספר כרטיס':   acc.accountNumber || 'לא ידוע',
        'סוג כרטיס':    acc.cardType || '',
        'תאריך עסקה':   txn.date ? new Date(txn.date) : '',
        'תאריך חיוב':   txn.processedDate ? new Date(txn.processedDate) : '',
        'שם בית העסק':  txn.description || txn.memo || '',
        'סכום ש"ח':     txn.chargedAmount ?? txn.originalAmount ?? 0,
        'מטבע מקורי':   txn.originalCurrency || 'ILS',
        'סכום מקורי':   txn.originalAmount ?? '',
        'סטטוס':        txn.status === 'pending' ? 'ממתין' : 'הושלם',
        'סוג':          txn.type === 'installments' ? 'תשלומים' : 'רגיל',
        'תשלום':        txn.installments ? `${txn.installments.number}/${txn.installments.total}` : '',
        'קטגוריה':      txn.category || '',
      }))
    );
    const wsAll = XLSX.utils.json_to_sheet(allRows, { cellDates: true });
    wsAll['!cols'] = [18,14,14,14,35,14,10,14,10,10,10,18].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsAll, 'כל העסקאות');

    // גיליון לכל כרטיס
    for (const acc of accounts) {
      if (!acc.txns.length) continue;
      const rows = acc.txns.map(txn => ({
        'תאריך עסקה':  txn.date ? new Date(txn.date) : '',
        'תאריך חיוב':  txn.processedDate ? new Date(txn.processedDate) : '',
        'שם בית העסק': txn.description || txn.memo || '',
        'סכום ש"ח':    txn.chargedAmount ?? txn.originalAmount ?? 0,
        'מטבע מקורי':  txn.originalCurrency || 'ILS',
        'סכום מקורי':  txn.originalAmount ?? '',
        'סטטוס':       txn.status === 'pending' ? 'ממתין' : 'הושלם',
        'סוג':         txn.type === 'installments' ? 'תשלומים' : 'רגיל',
        'תשלום':       txn.installments ? `${txn.installments.number}/${txn.installments.total}` : '',
        'קטגוריה':     txn.category || '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true });
      ws['!cols'] = [14,14,35,14,10,14,10,10,10,18].map(w => ({ wch: w }));
      const name = `${acc.cardType || 'כרטיס'} ${acc.accountNumber || ''}`.trim().slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    XLSX.writeFile(wb, `כאל_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const totalTxns = accounts ? accounts.reduce((s, a) => s + a.txns.length, 0) : 0;
  const reset = () => {
    setStage('credentials'); setError(''); setAccounts(null);
    setOtp(''); setUuid(''); setMaskedPhone('');
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl" dir="rtl">
      <Card className="shadow-lg">
        <CardHeader className="text-center border-b pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <CreditCard className="h-8 w-8 text-blue-600" />
            <CardTitle className="text-3xl font-bold">ייבוא מכאל — כניסה מהירה</CardTitle>
          </div>
          <CardDescription className="text-base text-slate-600">
            כניסה עם תעודת זהות + 4 ספרות כרטיס → קבל את כל הכרטיסים (Visa + Diners)
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8">

          {/* ── שלב 1: פרטי זיהוי ── */}
          {stage === 'credentials' && (
            <form onSubmit={handleRequestOtp} className="max-w-sm mx-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">מספר תעודת זהות</label>
                <Input
                  type="text" inputMode="numeric"
                  value={id} onChange={e => setId(e.target.value.replace(/\D/g,''))}
                  maxLength={9} required placeholder="000000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">4 ספרות אחרונות של הכרטיס</label>
                <Input
                  type="text" inputMode="numeric"
                  value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g,''))}
                  maxLength={4} required placeholder="1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">מאיזה תאריך</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">קבלת קוד באמצעות</label>
                <div className="flex gap-2">
                  {OTP_CHANNELS.map(({ value, label, icon: Icon }) => (
                    <button key={value} type="button"
                      onClick={() => setChannel(value)}
                      className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs font-medium transition-colors
                        ${channel === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-md border text-center">
                הפרטים משמשים רק לכניסה ולא נשמרים
              </p>
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={loading || id.length < 8 || last4.length !== 4}>
                {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Smartphone className="ml-2 h-4 w-4" />}
                שלחו לי סיסמה ב-{OTP_CHANNELS.find(c => c.value === channel)?.label}
              </Button>
            </form>
          )}

          {/* ── שלב 2: הזנת OTP ── */}
          {stage === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="max-w-sm mx-auto space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-slate-600">שלחנו לך SMS עם סיסמה למספר:</p>
                <p className="text-lg font-bold text-slate-800 mt-1">{maskedPhone || '054-*****XX'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">הסיסמה שקיבלת (6 ספרות)</label>
                <Input
                  type="text" inputMode="numeric"
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
                  maxLength={6} required placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={otp.length !== 6}>
                כניסה וייבוא עסקאות
              </Button>
              <button type="button" onClick={() => setStage('credentials')}
                className="w-full text-sm text-slate-400 hover:text-slate-600 text-center">
                חזור
              </button>
            </form>
          )}

          {/* ── שלב 3: טעינה ── */}
          {stage === 'loading' && (
            <div className="text-center py-16 space-y-4">
              <Loader2 className="mx-auto h-16 w-16 text-blue-500 animate-spin" />
              <p className="text-xl font-semibold">מתחבר לכאל ושולף עסקאות...</p>
              <p className="text-slate-400 text-sm">שולף מכל הכרטיסים: Visa + Diners</p>
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
                <div className="flex gap-3">
                  <Button onClick={handleDownloadExcel} className="bg-green-600 hover:bg-green-700">
                    <FileSpreadsheet className="ml-2 h-4 w-4" />
                    הורד אקסל
                  </Button>
                  <Button variant="outline" onClick={reset}>ייבוא חדש</Button>
                </div>
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
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">מקורי</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">סטטוס</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">תשלומים</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acc.txns.map((txn, ti) => {
                            const charged = txn.chargedAmount ?? txn.originalAmount;
                            const isCredit = charged != null && charged < 0;
                            const isPending = txn.status === 'pending';
                            return (
                              <tr key={ti} className={`border-b last:border-0 ${ti % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${isPending ? 'opacity-60' : ''}`}>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(txn.date)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatDate(txn.processedDate)}</td>
                                <td className="px-3 py-2 font-medium max-w-[220px]">
                                  <span className="block truncate" title={txn.description}>{txn.description || txn.memo || '-'}</span>
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap font-mono font-medium ${isCredit ? 'text-green-600' : 'text-slate-800'}`}>
                                  {charged != null ? `${formatAmount(charged, 'ILS')}${isCredit ? ' ↩' : ''}` : '-'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-500 text-xs">
                                  {txn.originalCurrency && txn.originalCurrency !== 'ILS'
                                    ? formatAmount(txn.originalAmount, txn.originalCurrency) : '-'}
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

              <div className="flex justify-center pt-2">
                <Button onClick={handleDownloadExcel} size="lg" className="bg-green-600 hover:bg-green-700">
                  <FileSpreadsheet className="ml-2 h-5 w-5" />
                  הורד אקסל ({totalTxns} עסקאות)
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
