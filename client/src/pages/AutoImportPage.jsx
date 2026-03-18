import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import { Download, Settings, CheckCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, FileJson, Smartphone, MessageCircle, Phone } from 'lucide-react';

const OTP_CHANNELS = [
  { value: 'SMS',       label: 'SMS',       icon: Smartphone },
  { value: 'WHATSAPP',  label: 'WhatsApp',  icon: MessageCircle },
  { value: 'VOICE',     label: 'שיחת טלפון', icon: Phone },
];

const CREATE_NEW_CATEGORY_VALUE = 'CREATE_NEW';

function getDefaultStartDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
}

export default function AutoImportPage() {
  const [stage, setStage] = useState('credentials');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [fields, setFields] = useState({});
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [incomesOnly, setIncomesOnly] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [unseenMerchants, setUnseenMerchants] = useState([]);
  const [mappings, setMappings] = useState({});
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [balances, setBalances] = useState([]);
  const [futureDebits, setFutureDebits] = useState([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentMerchantForNewCategory, setCurrentMerchantForNewCategory] = useState(null);
  const [rawAccounts, setRawAccounts] = useState(null);
  const [showRawData, setShowRawData] = useState(false);

  // CAL OTP flow state
  const [calId, setCalId] = useState('');
  const [calLast4, setCalLast4] = useState('');
  const [calChannel, setCalChannel] = useState('SMS');
  const [calOtp, setCalOtp] = useState('');
  const [calMaskedPhone, setCalMaskedPhone] = useState('');
  const [calError, setCalError] = useState('');
  const [calLoading, setCalLoading] = useState(false);

  useEffect(() => {
    api.get('/scrape/companies').then(res => {
      setCompanies(res.data);
      if (res.data.length > 0) {
        setSelectedCompany(res.data[0].value);
        setIncomesOnly(res.data[0].group === 'בנקים');
      }
    }).catch(() => {});
    api.get('/categories').then(res => setCategories(res.data)).catch(() => {});
  }, []);

  const companyConfig = companies.find(c => c.value === selectedCompany);
  const companyFields = companyConfig?.fields || [];

  const isBank = companyConfig?.group === 'בנקים';
  const isCalOtp = selectedCompany === 'visaCal';

  const handleCompanyChange = (value) => {
    setSelectedCompany(value);
    setFields({});
    const cfg = companies.find(c => c.value === value);
    setIncomesOnly(cfg?.group === 'בנקים');
    // reset CAL OTP state when switching companies
    setCalId(''); setCalLast4(''); setCalOtp(''); setCalMaskedPhone(''); setCalError('');
    if (stage === 'cal-otp') setStage('credentials');
  };

  // ── CAL OTP: שלב 1 — בקשת קוד ──
  const handleCalRequestOtp = async (e) => {
    e.preventDefault();
    setCalLoading(true);
    setCalError('');
    try {
      const { data } = await api.post('/cal/request-otp', { id: calId, last4: calLast4, channel: calChannel });
      setCalMaskedPhone(data.maskedPhone || '');
      setStage('cal-otp');
    } catch (err) {
      setCalError(err.response?.data?.message || 'שגיאה בשליחת הקוד');
    } finally {
      setCalLoading(false);
    }
  };

  // ── CAL OTP: שלב 2 — אימות + ייבוא ──
  const handleCalVerifyAndImport = async (e) => {
    e.preventDefault();
    setStage('loading');
    setCalError('');
    setMessage('מתחבר לכאל ושולף עסקאות...');
    try {
      const { data } = await api.post('/cal/verify-otp-import', {
        id: calId, last4: calLast4, otp: calOtp, startDate,
      }, { timeout: 120000 });

      setParsedData(data.transactions);
      setRawAccounts(null);

      if (data.unseenMerchants?.length > 0) {
        setUnseenMerchants(data.unseenMerchants);
        const init = {};
        data.unseenMerchants.forEach(n => { init[n] = { newName: n, category: '' }; });
        setMappings(init);
        setStage('map');
      } else {
        await processData([], data.transactions);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setCalError('קוד שגוי או פג תוקף');
        setStage('cal-otp');
      } else {
        setIsError(true);
        setMessage(err.response?.data?.message || err.message || 'שגיאה בייבוא מכאל');
        setStage('result');
      }
    }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    setStage('loading');
    setMessage(`מתחבר לאתר ${companyConfig?.label || ''}...`);

    try {
      const { data } = await api.post('/scrape', {
        company: selectedCompany,
        startDate,
        incomesOnly,
        ...fields,
      }, { timeout: 120000 });

      setParsedData(data.transactions);
      setBalances(data.balances || []);
      setFutureDebits(data.futureDebits || []);
      setRawAccounts(data.rawAccounts || null);

      if (data.unseenMerchants?.length > 0) {
        setUnseenMerchants(data.unseenMerchants);
        const init = {};
        data.unseenMerchants.forEach(n => { init[n] = { newName: n, category: '' }; });
        setMappings(init);
        setStage('map');
      } else {
        await processData([], data.transactions);
      }
    } catch (error) {
      setIsError(true);
      setMessage(error.response?.data?.message || error.message || `שגיאה בהתחברות ל${companyConfig?.label || ''}.`);
      setStage('result');
    }
  };

  const handleMappingChange = (name, field, value) => {
    if (field === 'category' && value === CREATE_NEW_CATEGORY_VALUE) {
      setCurrentMerchantForNewCategory(name);
      setIsCategoryDialogOpen(true);
    } else {
      setMappings(prev => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
    }
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const { data: cat } = await api.post('/categories', { name: newCategoryName.trim(), type: 'הוצאה' });
      setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      if (currentMerchantForNewCategory) handleMappingChange(currentMerchantForNewCategory, 'category', cat._id);
      setIsCategoryDialogOpen(false);
      setNewCategoryName('');
      setCurrentMerchantForNewCategory(null);
    } catch (err) {
      alert(`שגיאה: ${err.response?.data?.message || err.message}`);
    }
  };

  const processData = async (mappingsToSave, dataToProcess) => {
    setStage('processing');
    setMessage('מעבד עסקאות ושומר...');
    try {
      const finalTransactions = dataToProcess.map(trx => {
        const orig = trx.rawDescription || trx.description;
        const m = mappingsToSave.find(x => x.originalName === orig);
        if (m) {
          const newCat = categories.find(c => c._id === m.category)?.name;
          return { ...trx, description: m.newName || trx.description, ...(newCat && { category: newCat }) };
        }
        return trx;
      });
      const { data } = await api.post('/import/process-transactions', {
        transactions: finalTransactions,
        newMappings: mappingsToSave,
      });
      setIsError(false);
      setMessage(data.message);
      setStage('result');
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.message || 'שגיאה בעיבוד הנתונים.');
      setStage('result');
    }
  };

  const handleProcessClick = async (forceAll = false) => {
    const finalMappings = [];
    for (const name of unseenMerchants) {
      const m = mappings[name];
      if (m.category === CREATE_NEW_CATEGORY_VALUE) { alert('יש ליצור קטגוריה חדשה דרך החלון שנפתח.'); return; }
      if (m.category) {
        finalMappings.push({ originalName: name, newName: m.newName.trim() || name, category: m.category });
      } else if (!forceAll) {
        alert(`נא לבחור קטגוריה עבור "${name}"`); return;
      } else {
        finalMappings.push({ originalName: name, newName: m.newName.trim() || name, category: null });
      }
    }
    await processData(finalMappings, parsedData);
  };

  const reset = () => {
    setStage('credentials');
    setMessage('');
    setIsError(false);
    setParsedData([]);
    setUnseenMerchants([]);
    setBalances([]);
    setFutureDebits([]);
    setRawAccounts(null);
    setShowRawData(false);
    setFields({});
    setIncomesOnly(companyConfig?.group === 'בנקים');
    setCalId(''); setCalLast4(''); setCalOtp(''); setCalMaskedPhone(''); setCalError(''); setCalLoading(false);
  };

  const downloadRawJson = () => {
    if (!rawAccounts) return;
    const blob = new Blob([JSON.stringify(rawAccounts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraper-raw-${selectedCompany}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group companies by group
  const groups = companies.reduce((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {});

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">ייבוא אוטומטי</CardTitle>
          <CardDescription className="text-lg text-slate-600 mt-2">
            הזן את פרטי הכניסה שלך והמערכת תוריד את העסקאות אוטומטית
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">

          {stage === 'credentials' && (
            <form onSubmit={isCalOtp ? handleCalRequestOtp : handleScrape} className="w-full max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">חברת אשראי / בנק</label>
                <Select value={selectedCompany} onValueChange={handleCompanyChange}>
                  <SelectTrigger><SelectValue placeholder="בחר חברה" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(groups).map(([group, items]) => (
                      <React.Fragment key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{group}</div>
                        {items.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCalOtp ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">מספר תעודת זהות</label>
                    <Input
                      type="text" inputMode="numeric"
                      value={calId} onChange={e => setCalId(e.target.value.replace(/\D/g,''))}
                      maxLength={9} required placeholder="000000000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">4 ספרות אחרונות של הכרטיס</label>
                    <Input
                      type="text" inputMode="numeric"
                      value={calLast4} onChange={e => setCalLast4(e.target.value.replace(/\D/g,''))}
                      maxLength={4} required placeholder="1234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">קבלת קוד באמצעות</label>
                    <div className="flex gap-2">
                      {OTP_CHANNELS.map(({ value, label, icon: Icon }) => (
                        <button key={value} type="button"
                          onClick={() => setCalChannel(value)}
                          className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs font-medium transition-colors
                            ${calChannel === value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {companyFields.map(field => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                      <Input
                        type={field.type}
                        inputMode={field.inputMode}
                        value={fields[field.name] || ''}
                        onChange={e => setFields(prev => ({ ...prev, [field.name]: e.target.value }))}
                        autoComplete={field.type === 'password' ? 'current-password' : field.type === 'email' ? 'email' : 'off'}
                        required
                      />
                    </div>
                  ))}
                </>
              )}

              {isBank && (
                <label className="flex items-center gap-3 p-3 rounded-md border bg-slate-50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incomesOnly}
                    onChange={e => setIncomesOnly(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    הכנסות בלבד
                    <span className="block text-xs font-normal text-slate-400">ייבא רק זיכויים (משכורת, העברות נכנסות) — מומלץ לבנקים</span>
                  </span>
                </label>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">מאיזה תאריך</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-md border">
                הפרטים שלך משמשים רק להתחברות ולא נשמרים בשרת.
              </p>

              {calError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{calError}
                </div>
              )}

              {isCalOtp ? (
                <Button type="submit" size="lg" className="w-full" disabled={calLoading || calId.length < 8 || calLast4.length !== 4}>
                  {calLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Smartphone className="ml-2 h-4 w-4" />}
                  שלחו לי קוד ב-{OTP_CHANNELS.find(c => c.value === calChannel)?.label}
                </Button>
              ) : (
                <Button type="submit" size="lg" className="w-full" disabled={!selectedCompany}>
                  <Download className="ml-2 h-4 w-4" />
                  הורד עסקאות מ{companyConfig?.label || ''}
                </Button>
              )}
            </form>
          )}

          {stage === 'cal-otp' && (
            <form onSubmit={handleCalVerifyAndImport} className="w-full max-w-md space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-slate-600">שלחנו לך קוד למספר:</p>
                <p className="text-lg font-bold text-slate-800 mt-1">{calMaskedPhone || '054-*****XX'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">הקוד שקיבלת (6 ספרות)</label>
                <Input
                  type="text" inputMode="numeric"
                  value={calOtp} onChange={e => setCalOtp(e.target.value.replace(/\D/g,''))}
                  maxLength={6} required placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
              </div>
              {calError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{calError}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={calOtp.length !== 6}>
                כניסה וייבוא עסקאות
              </Button>
              <button type="button" onClick={() => setStage('credentials')}
                className="w-full text-sm text-slate-400 hover:text-slate-600 text-center">
                חזור
              </button>
            </form>
          )}

          {stage === 'loading' && (
            <div className="text-center p-8 space-y-4">
              <Loader2 className="mx-auto h-16 w-16 text-blue-500 animate-spin" />
              <h2 className="text-2xl font-bold">מוריד עסקאות...</h2>
              <p className="text-slate-500">{message}</p>
              <p className="text-xs text-slate-400">התהליך עשוי לקחת עד דקה</p>
            </div>
          )}

          {stage === 'map' && (
            <div className="w-full">
              <div className="text-center mb-6">
                <Settings className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="text-xl font-semibold mt-4">מיפוי ספקים חדשים</h3>
                <p className="text-slate-500">נמצאו {unseenMerchants.length} ספקים חדשים.</p>
              </div>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 border-t border-b py-4">
                {unseenMerchants.map(name => (
                  <div key={name} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-2 rounded-md hover:bg-slate-50">
                    <span className="truncate font-medium" title={name}>{name}</span>
                    <Input
                      placeholder="שם נקי (אופציונלי)"
                      value={mappings[name]?.newName || ''}
                      onChange={e => handleMappingChange(name, 'newName', e.target.value)}
                    />
                    <Select value={mappings[name]?.category || ''} onValueChange={v => handleMappingChange(name, 'category', v)}>
                      <SelectTrigger><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>)}
                        <SelectItem value={CREATE_NEW_CATEGORY_VALUE}>--- צור קטגוריה חדשה ---</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-4 pt-6">
                <Button type="button" variant="ghost" onClick={() => handleProcessClick(true)}>ייבא הכל (ושייך מאוחר יותר)</Button>
                <Button type="button" onClick={() => handleProcessClick(false)}>סיים וייבא</Button>
              </div>
            </div>
          )}

          {(stage === 'processing' || stage === 'result') && (
            <div className="text-center p-8 space-y-4 w-full">
              {stage === 'processing'
                ? <Loader2 className="mx-auto h-16 w-16 text-blue-500 animate-spin" />
                : isError
                  ? <AlertTriangle className="mx-auto h-16 w-16 text-red-400" />
                  : <CheckCircle className="mx-auto h-16 w-16 text-green-400" />
              }
              <h2 className="text-2xl font-bold">{stage === 'processing' ? 'בתהליך...' : 'הסתיים'}</h2>
              <p className={isError ? 'text-red-600' : 'text-green-600'}>{message}</p>

              {stage === 'result' && balances.length > 0 && (
                <div className="mt-4 text-right border rounded-md p-4 bg-slate-50 space-y-1">
                  <p className="font-semibold text-slate-700 mb-2">יתרות חשבון:</p>
                  {balances.map((b, i) => (
                    <p key={i} className="text-sm text-slate-600">
                      חשבון {b.accountNumber}: <span className="font-medium">{b.balance?.toLocaleString('he-IL')} ₪</span>
                    </p>
                  ))}
                </div>
              )}

              {stage === 'result' && futureDebits.length > 0 && (
                <div className="mt-4 text-right border rounded-md p-4 bg-amber-50 space-y-1">
                  <p className="font-semibold text-slate-700 mb-2">חיובים עתידיים:</p>
                  {futureDebits.map((d, i) => (
                    <p key={i} className="text-sm text-slate-600">
                      {d.chargeDate ? new Date(d.chargeDate).toLocaleDateString('he-IL') : ''}{d.bankAccountNumber ? ` • חשבון ${d.bankAccountNumber}` : ''}: <span className="font-medium">{d.amount?.toLocaleString('he-IL')} {d.amountCurrency}</span>
                    </p>
                  ))}
                </div>
              )}

              {stage === 'result' && rawAccounts && (
                <div className="mt-6 w-full text-right border rounded-lg bg-white">
                  <button
                    onClick={() => setShowRawData(v => !v)}
                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-semibold text-slate-700 flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      נתונים גולמיים מהסקרייפר — {rawAccounts.length} חשבונות, {rawAccounts.reduce((s, a) => s + a.txnCount, 0)} עסקאות
                    </span>
                    {showRawData ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showRawData && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={downloadRawJson}>
                          <Download className="ml-1 h-3.5 w-3.5" />
                          הורד JSON
                        </Button>
                      </div>
                      {rawAccounts.map((acc, ai) => (
                        <div key={ai} className="border rounded-md overflow-hidden">
                          <div className="bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 flex justify-between">
                            <span>חשבון: {acc.accountNumber || 'לא ידוע'}</span>
                            <span>{acc.txnCount} עסקאות{acc.balance != null ? ` • יתרה: ${acc.balance.toLocaleString('he-IL')} ₪` : ''}</span>
                          </div>
                          <div className="max-h-80 overflow-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                  <th className="px-2 py-1 text-right">#</th>
                                  <th className="px-2 py-1 text-right">תאריך</th>
                                  <th className="px-2 py-1 text-right">חיוב</th>
                                  <th className="px-2 py-1 text-right">תיאור</th>
                                  <th className="px-2 py-1 text-right">סכום מקורי</th>
                                  <th className="px-2 py-1 text-right">chargedAmount</th>
                                  <th className="px-2 py-1 text-right">סטטוס</th>
                                  <th className="px-2 py-1 text-right">סוג</th>
                                  <th className="px-2 py-1 text-right">תשלומים</th>
                                  <th className="px-2 py-1 text-right">קטגוריה</th>
                                </tr>
                              </thead>
                              <tbody>
                                {acc.txns.map((txn, ti) => (
                                  <tr key={ti} className={ti % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="px-2 py-1 text-slate-400">{ti + 1}</td>
                                    <td className="px-2 py-1 whitespace-nowrap">{txn.date ? new Date(txn.date).toLocaleDateString('he-IL') : '-'}</td>
                                    <td className="px-2 py-1 whitespace-nowrap">{txn.processedDate ? new Date(txn.processedDate).toLocaleDateString('he-IL') : '-'}</td>
                                    <td className="px-2 py-1 font-medium max-w-[200px] truncate" title={txn.description}>{txn.description}</td>
                                    <td className="px-2 py-1 whitespace-nowrap">{txn.originalAmount != null ? `${txn.originalAmount} ${txn.originalCurrency || ''}` : '-'}</td>
                                    <td className="px-2 py-1 whitespace-nowrap font-mono">{txn.chargedAmount ?? '-'}</td>
                                    <td className="px-2 py-1">{txn.status || '-'}</td>
                                    <td className="px-2 py-1">{txn.type || '-'}</td>
                                    <td className="px-2 py-1 whitespace-nowrap">{txn.installments ? `${txn.installments.number}/${txn.installments.total}` : '-'}</td>
                                    <td className="px-2 py-1">{txn.category || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {stage === 'result' && <Button onClick={reset} className="mt-6">ייבוא חדש</Button>}
            </div>
          )}

        </CardContent>
      </Card>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>הוספת קטגוריה חדשה</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input placeholder="שם הקטגוריה..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsCategoryDialogOpen(false)}>ביטול</Button>
            <Button type="button" onClick={handleSaveNewCategory}>שמור קטגוריה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
