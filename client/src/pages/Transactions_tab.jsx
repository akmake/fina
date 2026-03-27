import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { format, isSameMonth, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Upload, Search, ChevronDown, Loader2, X, Save, Zap } from 'lucide-react';

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
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-20">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/50 px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">הארנק שלי</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => navigate('/import/auto')}
            className="rounded-full h-9 sm:h-10 px-4 sm:px-5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex-1 sm:flex-none text-sm font-semibold flex items-center gap-2"
          >
            <Zap className="h-4 w-4" /> ייבוא אוטומטי
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full h-9 sm:h-10 px-4 sm:px-6 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-md transition-all flex-1 sm:flex-none text-sm font-semibold">
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
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* KPI bar */}
        <KpiBar transactions={transactions} effectiveMonth={effectiveMonth} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">

          {/* Main feed */}
          <main className="lg:col-span-8">

            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">פעילות</h2>
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
                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="חיפוש לפי תיאור או קטגוריה..."
                    className="h-10 pl-4 pr-9 rounded-full bg-white/60 backdrop-blur-sm border-white/50 shadow-sm text-sm w-full"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-1 sm:gap-2 bg-white/60 p-1 rounded-full border border-white/50 shadow-sm w-fit">
                  {[['all', 'הכל'], ['expense', 'הוצאות'], ['income', 'הכנסות']].map(([val, label]) => (
                    <Badge
                      key={val}
                      onClick={() => setFilterType(val)}
                      className={`cursor-pointer px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-medium text-xs sm:text-sm transition-colors ${
                        filterType === val ? 'bg-white hover:bg-slate-50 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/50'
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
              <div className="text-center py-16 bg-white/40 rounded-3xl border border-white/50">
                <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700">לא נמצאו עסקאות</h3>
                <p className="text-sm text-slate-500">נסה לשנות את הסינון</p>
              </div>
            ) : (
              <>
                {groupedByMonth.map(([monthLabel, { date, txns }]) => (
                  <div key={monthLabel} className="mb-10">
                    <div className="sticky top-20 z-20 backdrop-blur-md bg-[#F2F4F8]/80 py-2 mb-4 px-2 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                        {monthLabel}
                        {isSameMonth(date, new Date()) && (
                          <span className="mr-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full normal-case">החודש</span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400">{txns.length} עסקאות</span>
                    </div>
                    <div className="space-y-2">
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

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            <AddTransactionForm
              categories={categories}
              onAdd={refresh}
              onCategoryCreated={cat =>
                setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
              }
            />
          </aside>
        </div>
      </div>

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
