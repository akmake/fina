import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { format, isSameMonth, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Upload, Search, ChevronDown, Loader2, X, Save, Zap, Plus, Receipt } from 'lucide-react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { TransactionCard } from '@/components/transactions/TransactionCard';
import KpiBar from '@/components/transactions/KpiBar';
import MerchantDialog from '@/components/transactions/MerchantDialog';
import ImportWizard from '@/components/transactions/ImportWizard';
import AddTransactionForm from '@/components/transactions/AddTransactionForm';

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Data ───────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  // Tracks the start of the oldest month currently loaded
  const [oldestMonth,  setOldestMonth]  = useState(null);

  // ─── Filters ────────────────────────────────────────────────
  const [filterType,     setFilterType]     = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [filterCategory, setFilterCategory] = useState(() => searchParams.get('category') ?? '');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // ─── Scroll sentinel ─────────────────────────────────────────
  const sentinelRef = useRef(null);

  // ─── Merchant dialog ─────────────────────────────────────────
  const [selectedMerchant,     setSelectedMerchant]     = useState(null);
  const [isMerchantDialogOpen, setIsMerchantDialogOpen] = useState(false);

  // ─── Edit dialog ──────────────────────────────────────────────
  const [editingTrx,  setEditingTrx]  = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [editSaving,  setEditSaving]  = useState(false);

  // ─── Import wizard ────────────────────────────────────────────
  const [importState,     setImportState]     = useState('idle');
  const [importerType,    setImporterType]    = useState('');
  const [parsedTxns,      setParsedTxns]      = useState([]);
  const [unseenMerchants, setUnseenMerchants] = useState([]);
  const [mappings,        setMappings]        = useState({});
  const [importMessage,   setImportMessage]   = useState('');
  const fileInputRef = useRef(null);

  // ─── Helpers ─────────────────────────────────────────────────
  const fetchMonth = useCallback(async (monthDate) => {
    const from = startOfMonth(monthDate).toISOString();
    const to   = endOfMonth(monthDate).toISOString();
    const res  = await api.get(`/transactions?from=${from}&to=${to}`);
    return res.data || [];
  }, []);

  // ─── Initial load ────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [latestRes, catRes] = await Promise.all([
          api.get('/transactions?limit=1'),
          api.get('/categories'),
        ]);
        setCategories(catRes.data || []);
        const latest = latestRes.data?.[0];
        if (!latest) { setHasMore(false); return; }

        const effectiveMonth = startOfMonth(new Date(latest.date));
        const data = await fetchMonth(effectiveMonth);
        setTransactions(data);
        setOldestMonth(effectiveMonth);
        setHasMore(true);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    init();
  }, [fetchMonth]);

  // ─── Load more — month by month ───────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !oldestMonth) return;
    setLoadingMore(true);
    try {
      // 1. Is there anything older than the current oldest month?
      const checkRes = await api.get(
        `/transactions?before=${startOfMonth(oldestMonth).toISOString()}&limit=1`
      );
      if (!checkRes.data?.length) { setHasMore(false); return; }

      // 2. Load the full month that contains that older transaction
      const targetMonth = startOfMonth(new Date(checkRes.data[0].date));
      const data = await fetchMonth(targetMonth);
      if (data.length > 0) {
        setTransactions(prev => [...prev, ...data]);
        setOldestMonth(targetMonth);
      } else {
        setHasMore(false);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, oldestMonth, fetchMonth]);

  // ─── Merchant changed (name or category) — update all loaded months instantly ───
  const handleMerchantChanged = useCallback((oldName, changes) => {
    setTransactions(prev => prev.map(t =>
      t.description === oldName ? { ...t, ...changes } : t
    ));
  }, []);

  // ─── Refresh (after add/delete) ──────────────────────────────
  const refresh = useCallback(async () => {
    try {
      // Clear stale search results so UI shows fresh DB data
      setSearchQuery('');
      setSearchResults(null);
      searchVersionRef.current++;

      const latestRes = await api.get('/transactions?limit=1');
      const latest = latestRes.data?.[0];
      if (!latest) { setTransactions([]); setHasMore(false); return; }
      const effectiveMonth = startOfMonth(new Date(latest.date));
      const data = await fetchMonth(effectiveMonth);
      setTransactions(data);
      setOldestMonth(effectiveMonth);
      setHasMore(true);
    } catch (err) { console.error(err); }
  }, [fetchMonth]);

  // ─── Intersection Observer ───────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // ─── Search (server-side for full history) ────────────────────
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const searchTimerRef = useRef(null);
  const searchVersionRef = useRef(0);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      searchVersionRef.current++;
      return;
    }
    clearTimeout(searchTimerRef.current);
    const version = ++searchVersionRef.current;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const typeParam = filterType !== 'all' ? `&type=${filterType}` : '';
        const { data } = await api.get(`/transactions/search?q=${encodeURIComponent(searchQuery.trim())}${typeParam}`);
        if (version === searchVersionRef.current) setSearchResults(data);
      } catch {
        if (version === searchVersionRef.current) setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, filterType]);

  // ─── Derived state ───────────────────────────────────────────
  // Effective month = most recent loaded transaction's month
  const effectiveMonth = useMemo(() =>
    transactions.length ? new Date(transactions[0].date) : new Date(),
    [transactions]
  );

  // Filtered + grouped by month
  const filteredTransactions = useMemo(() => {
    // If we have server search results, use those
    if (searchResults !== null) return searchResults;

    let result = transactions;
    if (filterType === 'expense') result = result.filter(t => t.type === 'הוצאה');
    if (filterType === 'income')  result = result.filter(t => t.type === 'הכנסה');
    if (filterCategory)           result = result.filter(t => t.category === filterCategory);
    return result;
  }, [transactions, filterType, filterCategory, searchResults]);

  const groupedByMonth = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(t => {
      const key = format(new Date(t.date), 'LLLL yyyy', { locale: he });
      if (!groups[key]) groups[key] = { date: new Date(t.date), txns: [] };
      groups[key].txns.push(t);
    });
    return Object.entries(groups).sort((a, b) => b[1].date - a[1].date);
  }, [filteredTransactions]);

  // ─── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      setTransactions(prev => prev.filter(t => t._id !== id));
    } catch { alert('שגיאה במחיקת העסקה'); }
  };

  // ─── Edit ────────────────────────────────────────────────────
  const openEdit = (trx) => {
    setEditingTrx(trx);
    setEditForm({
      description: trx.description || '',
      amount:      trx.amount ?? '',
      type:        trx.type || 'הוצאה',
      category:    trx.category || 'כללי',
      date:        trx.date ? trx.date.split('T')[0] : '',
    });
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const { data } = await api.put(`/transactions/${editingTrx._id}`, {
        ...editForm,
        amount: Number(editForm.amount),
      });
      setTransactions(prev => prev.map(t => t._id === editingTrx._id ? { ...t, ...editForm, amount: Number(editForm.amount) } : t));
      setEditingTrx(null);
    } catch { alert('שגיאה בשמירה'); }
    finally { setEditSaving(false); }
  };

  // ─── Import ──────────────────────────────────────────────────
  const resetImport = () => {
    setImportState('idle'); setImporterType(''); setParsedTxns([]);
    setUnseenMerchants([]); setMappings({}); setImportMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportClick = (type) => {
    resetImport(); setImporterType(type); fileInputRef.current?.click();
  };

  const analyzeFile = (file, type) => {
    setImportState('processing'); setImportMessage('מנתח קובץ...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        let allRaw = [];
        wb.SheetNames.forEach(s => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: null });
          if (rows.length) allRaw = allRaw.concat(rows);
        });
        const { data: res } = await api.post('/import/upload', { data: allRaw, fileType: type });
        setParsedTxns(res.transactions);
        if (res.unseenMerchants?.length > 0) {
          setUnseenMerchants(res.unseenMerchants);
          const init = {};
          res.unseenMerchants.forEach(n => { init[n] = { newName: n, category: '' }; });
          setMappings(init);
          setImportState('mapping');
        } else {
          setImportState('confirming');
        }
      } catch (err) {
        setImportMessage(err.response?.data?.message || 'שגיאה בקובץ');
        setImportState('error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (originalName, field, value) =>
    setMappings(prev => ({ ...prev, [originalName]: { ...prev[originalName], [field]: value } }));

  const handleConfirmImport = async () => {
    setImportState('processing'); setImportMessage('שומר נתונים...');
    const newMappings = Object.entries(mappings)
      .map(([orig, vals]) => ({ originalName: orig, newName: vals.newName.trim() || orig, category: vals.category || null }))
      .filter(m => m.newName !== m.originalName || m.category);

    const finalTxns = parsedTxns.map(trx => {
      const m = mappings[trx.description];
      if (m) {
        const newCat = categories.find(c => c._id === m.category)?.name;
        return { ...trx, description: m.newName.trim() || trx.description, ...(newCat && { category: newCat }) };
      }
      return trx;
    });

    try {
      await api.post('/import/process-transactions', { transactions: finalTxns, newMappings });
      setImportMessage('הייבוא הושלם בהצלחה');
      setImportState('finished');
      refresh();
    } catch {
      setImportMessage('שגיאה בשמירה');
      setImportState('error');
    }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f8fa] font-sans text-slate-900 dark:bg-[#0b0d11] dark:text-slate-100 pb-20">

      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white dark:border-white/[0.07] dark:bg-[#111318]">
        <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">ניהול פיננסי</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">עסקאות</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">כל ההכנסות וההוצאות במקום אחד</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsAddOpen(true)}
            className="rounded-lg h-9 sm:h-10 px-4 bg-slate-950 hover:bg-slate-800 text-white shadow-sm transition-colors flex-1 sm:flex-none text-xs font-semibold flex items-center gap-2 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" /> עסקה חדשה
          </Button>
          <Button
            onClick={() => navigate('/import/auto')}
            className="rounded-lg h-9 sm:h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex-1 sm:flex-none text-xs font-semibold flex items-center gap-2"
          >
            <Zap className="h-4 w-4" /> ייבוא אוטומטי
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-lg h-9 sm:h-10 px-4 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex-1 sm:flex-none text-xs font-semibold dark:bg-white/[0.04] dark:border-white/[0.09] dark:text-slate-200 dark:hover:bg-white/[0.07]">
                <Upload className="ml-2 h-4 w-4" /> ייבוא אשראי <ChevronDown className="mr-2 h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-2xl min-w-[150px]" align="end">
              <DropdownMenuItem onClick={() => handleImportClick('max')}      className="cursor-pointer font-medium py-3">Max</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleImportClick('cal')}      className="cursor-pointer font-medium py-3">Cal</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleImportClick('isracard')} className="cursor-pointer font-medium py-3">ישראכרט</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) analyzeFile(f, importerType); }} />
        </div>
        </div>
      </header>

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6">

        {/* KPI bar */}
        <KpiBar transactions={transactions} effectiveMonth={effectiveMonth} />

        <div>

          {/* Main feed */}
          <main className="min-w-0">

            {/* Search + filters */}
            <div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 shrink-0">
                <h2 className="text-base font-bold text-slate-950 dark:text-white">תנועות אחרונות</h2>
                {filterCategory && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                    {filterCategory}
                    <button onClick={() => { setFilterCategory(''); setSearchParams({}); }} className="hover:text-blue-900">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="חיפוש לפי תיאור או קטגוריה..."
                    className="h-9 pl-4 pr-9 rounded-lg bg-white border-slate-200 shadow-none text-xs w-full dark:bg-[#15181f] dark:border-white/[0.08]"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg dark:bg-white/[0.05] w-fit">
                  {[['all', 'הכל'], ['expense', 'הוצאות'], ['income', 'הכנסות']].map(([val, label]) => (
                    <Badge
                      key={val}
                      onClick={() => setFilterType(val)}
                      className={`cursor-pointer px-3 py-1.5 rounded-md font-medium text-[11px] transition-colors ${
                        filterType === val ? 'bg-white hover:bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'bg-transparent text-slate-500 hover:bg-white/50'
                      }`}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : groupedByMonth.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center dark:border-white/[0.12] dark:bg-[#15181f]">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Receipt className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                  {searchQuery || filterCategory || filterType !== 'all' ? 'לא נמצאו עסקאות' : 'העסקה הראשונה שלך מתחילה כאן'}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {searchQuery || filterCategory || filterType !== 'all'
                    ? 'אפשר לנקות את החיפוש או לשנות את מסנני התצוגה.'
                    : 'אפשר להוסיף עסקה ידנית או לייבא את הפעילות מהבנק ומחברות האשראי.'}
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  {searchQuery || filterCategory || filterType !== 'all' ? (
                    <Button
                      onClick={() => { setSearchQuery(''); setFilterCategory(''); setFilterType('all'); setSearchParams({}); }}
                      variant="outline"
                      className="h-10 rounded-lg px-5 text-xs font-semibold"
                    >
                      ניקוי מסננים
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => setIsAddOpen(true)} className="h-10 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700">
                        <Plus className="ml-2 h-4 w-4" /> הוספת עסקה
                      </Button>
                      <Button onClick={() => navigate('/import/auto')} variant="outline" className="h-10 rounded-lg border-slate-200 bg-white px-5 text-xs font-semibold dark:border-white/[0.09] dark:bg-white/[0.04]">
                        <Zap className="ml-2 h-4 w-4" /> חיבור חשבון
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {groupedByMonth.map(([monthLabel, { date, txns }]) => (
                  <div key={monthLabel} className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#15181f]">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-white/[0.07] dark:bg-white/[0.025]">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                        {monthLabel}
                        {isSameMonth(date, new Date()) && (
                          <span className="mr-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full normal-case">החודש</span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400">{txns.length} עסקאות</span>
                    </div>
                    <div>
                      {txns.map(t => (
                        <TransactionCard
                          key={t._id}
                          transaction={t}
                          onClick={() => { setSelectedMerchant({ name: t.description, category: t.category }); setIsMerchantDialogOpen(true); }}
                          onDelete={handleDelete}
                          onEdit={openEdit}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Scroll sentinel */}
                <div ref={sentinelRef} className="py-6 text-center">
                  {loadingMore ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-300 mx-auto" />
                  ) : hasMore ? (
                    <p className="text-xs text-slate-300">גולל למטה לטעינת עוד...</p>
                  ) : (
                    <p className="text-xs text-slate-300">הגעת לתחילת ההיסטוריה</p>
                  )}
                </div>
              </>
            )}
          </main>

        </div>
      </div>

      {/* Add transaction drawer */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
            onClick={() => setIsAddOpen(false)}
            aria-label="סגירת טופס"
          />
          <aside className="absolute inset-y-0 left-0 w-full max-w-[420px] overflow-y-auto border-r border-slate-200 bg-[#f7f8fa] p-4 shadow-2xl dark:border-white/[0.08] dark:bg-[#0f1116] sm:p-6">
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">עסקה חדשה</p>
                <p className="mt-0.5 text-[11px] text-slate-500">הפרטים יופיעו מיד ברשימת העסקאות</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-white/[0.07] dark:hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AddTransactionForm
              categories={categories}
              onAdd={() => { refresh(); setIsAddOpen(false); }}
              onCategoryCreated={cat =>
                setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
              }
            />
          </aside>
        </div>
      )}

      {/* Edit dialog */}
      {editingTrx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingTrx(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[17px] font-bold text-slate-900">עריכת עסקה</h3>
              <button onClick={() => setEditingTrx(null)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">תיאור</label>
                <input
                  value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">סכום (₪)</label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">סוג</label>
                  <select
                    value={editForm.type}
                    onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="הוצאה">הוצאה</option>
                    <option value="הכנסה">הכנסה</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">קטגוריה</label>
                  <input
                    value={editForm.category}
                    onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">תאריך</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditingTrx(null)}
                className="flex-1 h-11 rounded-2xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex-1 h-11 rounded-2xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                שמור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merchant dialog */}
      <MerchantDialog
        isOpen={isMerchantDialogOpen}
        onOpenChange={setIsMerchantDialogOpen}
        merchantName={selectedMerchant?.name ?? selectedMerchant}
        clickedCategory={selectedMerchant?.category}
        categories={categories}
        onRefresh={refresh}
        onMerchantChanged={handleMerchantChanged}
      />

      {/* Import wizard */}
      <ImportWizard
        importState={importState}
        importMessage={importMessage}
        unseenMerchants={unseenMerchants}
        mappings={mappings}
        parsedTransactions={parsedTxns}
        categories={categories}
        onMappingChange={handleMappingChange}
        onConfirm={handleConfirmImport}
        onReset={resetImport}
      />
    </div>
  );
}
