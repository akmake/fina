import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import { Download, Settings, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

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
  const [parsedData, setParsedData] = useState([]);
  const [unseenMerchants, setUnseenMerchants] = useState([]);
  const [mappings, setMappings] = useState({});
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [balances, setBalances] = useState([]);
  const [futureDebits, setFutureDebits] = useState([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentMerchantForNewCategory, setCurrentMerchantForNewCategory] = useState(null);

  useEffect(() => {
    api.get('/scrape/companies').then(res => {
      setCompanies(res.data);
      if (res.data.length > 0) setSelectedCompany(res.data[0].value);
    }).catch(() => {});
    api.get('/categories').then(res => setCategories(res.data)).catch(() => {});
  }, []);

  const companyConfig = companies.find(c => c.value === selectedCompany);
  const companyFields = companyConfig?.fields || [];

  const handleCompanyChange = (value) => {
    setSelectedCompany(value);
    setFields({});
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    setStage('loading');
    setMessage(`מתחבר לאתר ${companyConfig?.label || ''}...`);

    try {
      const { data } = await api.post('/scrape', {
        company: selectedCompany,
        startDate,
        ...fields,
      }, { timeout: 120000 });

      setParsedData(data.transactions);
      setBalances(data.balances || []);
      setFutureDebits(data.futureDebits || []);

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
      setMessage(data.message);
      setStage('result');
    } catch (err) {
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
    setParsedData([]);
    setUnseenMerchants([]);
    setBalances([]);
    setFutureDebits([]);
    setFields({});
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
            <form onSubmit={handleScrape} className="w-full max-w-md space-y-4">
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
              <Button type="submit" size="lg" className="w-full" disabled={!selectedCompany}>
                <Download className="ml-2 h-4 w-4" />
                הורד עסקאות מ{companyConfig?.label || ''}
              </Button>
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
                : message.includes('שגיאה')
                  ? <AlertTriangle className="mx-auto h-16 w-16 text-red-400" />
                  : <CheckCircle className="mx-auto h-16 w-16 text-green-400" />
              }
              <h2 className="text-2xl font-bold">{stage === 'processing' ? 'בתהליך...' : 'הסתיים'}</h2>
              <p className={message.includes('שגיאה') ? 'text-red-600' : 'text-green-600'}>{message}</p>

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
