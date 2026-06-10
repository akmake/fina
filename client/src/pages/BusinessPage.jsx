import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, Calendar, Store, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight, Search, BarChart3, Tag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/utils/api';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Math.abs(n));

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
export default function BusinessPage() {
  const now = new Date();
  const [tab, setTab] = useState('current');

  // Tab 1 — per-tab state
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [txSearch,   setTxSearch]   = useState('');
  const [showOnly,   setShowOnly]   = useState('all'); // 'all' | 'business'

  // Tab 2 — per-tab state
  const [merchantSearch, setMerchantSearch] = useState('');

  // Tab 3 — per-tab state
  const [summaryYear, setSummaryYear] = useState(now.getFullYear());

  const qc = useQueryClient();

  // ── Queries (each enabled only when its tab is active) ──────────────────
  const { data: monthExpenses = [], isLoading: loadingMonth } = useQuery({
    queryKey: ['biz-month', year, month],
    queryFn: () => api.get(`/business/month-expenses?year=${year}&month=${month}`).then(r => r.data),
    enabled: tab === 'current',
  });

  const { data: allMerchants = [], isLoading: loadingMerchants } = useQuery({
    queryKey: ['biz-merchants'],
    queryFn: () => api.get('/business/merchants').then(r => r.data),
    enabled: tab === 'merchants',
  });

  const { data: summary = {}, isLoading: loadingSummary } = useQuery({
    queryKey: ['biz-summary', summaryYear],
    queryFn: () => api.get(`/business/summary?year=${summaryYear}`).then(r => r.data),
    enabled: tab === 'summary',
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const toggleTx = useMutation({
    mutationFn: (id) => api.patch(`/business/transactions/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biz-month', year, month] }),
  });

  const toggleMerchant = useMutation({
    mutationFn: ({ name, isBusiness }) =>
      api.patch('/business/merchants/toggle', { merchantName: name, isBusiness }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['biz-merchants'] });
      // also refresh current month if the user goes back
      qc.invalidateQueries({ queryKey: ['biz-month'] });
    },
  });

  // ── KPIs derived from monthExpenses ─────────────────────────────────────
  const bizTotal = useMemo(() => monthExpenses.filter(t => t.isBusiness).reduce((s, t) => s + t.amount, 0), [monthExpenses]);
  const bizCount = useMemo(() => monthExpenses.filter(t => t.isBusiness).length, [monthExpenses]);

  // ── Filtered lists ───────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    let list = showOnly === 'business' ? monthExpenses.filter(t => t.isBusiness) : monthExpenses;
    if (txSearch.trim()) {
      const q = txSearch.trim().toLowerCase();
      list = list.filter(t => t.description.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q));
    }
    return list;
  }, [monthExpenses, showOnly, txSearch]);

  const filteredMerchants = useMemo(() => {
    if (!merchantSearch.trim()) return allMerchants;
    const q = merchantSearch.trim().toLowerCase();
    return allMerchants.filter(m => m.name.toLowerCase().includes(q));
  }, [allMerchants, merchantSearch]);

  // ── Month navigation ─────────────────────────────────────────────────────
  const moveMonth = (dir) => {
    setTxSearch('');
    setShowOnly('all');
    if (dir === -1 && month === 1) { setMonth(12); setYear(y => y - 1); }
    else if (dir === 1 && month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + dir);
  };

  const TABS = [
    { id: 'current',   label: 'ניהול שוטף',  icon: Calendar  },
    { id: 'merchants', label: 'ניהול עסקים', icon: Store     },
    { id: 'summary',   label: 'סיכום שנתי', icon: BarChart3 },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl">

      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
        <Briefcase className="h-6 w-6 text-indigo-600" />
        הוצאות עסקיות
      </h1>
      <p className="text-sm text-slate-400 mb-5">ניהול הוצאות עוסק פטור</p>

      {/* KPIs — visible only in current tab */}
      {tab === 'current' && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 mb-1">הוצאות עסקיות החודש</p>
            <p className="text-xl font-bold text-red-500">{fmt(bizTotal)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{bizCount} עסקאות מסומנות</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 mb-1">כלל הוצאות החודש</p>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{fmt(monthExpenses.reduce((s,t) => s+t.amount, 0))}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{monthExpenses.length} עסקאות</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              tab === t.id
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: ניהול שוטף ──────────────────────────────────── */}
      {tab === 'current' && (
        <CurrentTab
          year={year} month={month}
          expenses={filteredExpenses}
          allCount={monthExpenses.length}
          bizCount={bizCount}
          loading={loadingMonth}
          search={txSearch} setSearch={setTxSearch}
          showOnly={showOnly} setShowOnly={setShowOnly}
          onMoveMonth={moveMonth}
          onToggle={(id) => toggleTx.mutate(id)}
          pending={toggleTx.isPending}
        />
      )}

      {/* ── Tab 2: ניהול עסקים ─────────────────────────────────── */}
      {tab === 'merchants' && (
        <MerchantsTab
          merchants={filteredMerchants}
          loading={loadingMerchants}
          search={merchantSearch} setSearch={setMerchantSearch}
          onToggle={(name, current) => toggleMerchant.mutate({ name, isBusiness: !current })}
          pending={toggleMerchant.isPending}
        />
      )}

      {/* ── Tab 3: סיכום שנתי ──────────────────────────────────── */}
      {tab === 'summary' && (
        <SummaryTab
          summary={summary}
          loading={loadingSummary}
          year={summaryYear}
          onYearChange={setSummaryYear}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — ניהול שוטף
// ─────────────────────────────────────────────────────────────────────────────
function CurrentTab({ year, month, expenses, allCount, bizCount, loading, search, setSearch, showOnly, setShowOnly, onMoveMonth, onToggle, pending }) {
  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
        <button onClick={() => onMoveMonth(-1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>
        <span className="font-semibold text-sm text-slate-800 dark:text-white">
          {MONTHS[month - 1]} {year}
        </span>
        <button onClick={() => onMoveMonth(1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ChevronLeft className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Filter: all vs business */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowOnly('all')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            showOnly === 'all'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
          }`}
        >
          כל ההוצאות ({allCount})
        </button>
        <button
          onClick={() => setShowOnly('business')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            showOnly === 'business'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
          }`}
        >
          עסקיות בלבד ({bizCount})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש..."
          className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-400"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
        </div>
      ) : !expenses.length ? (
        <p className="text-center text-slate-400 py-12 text-sm">אין הוצאות</p>
      ) : (
        <div className="space-y-2">
          {expenses.map(tx => (
            <div
              key={tx._id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm border transition-colors ${
                tx.isBusiness
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{tx.description}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {tx.category && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <Tag className="h-2.5 w-2.5" /> {tx.category}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleDateString('he-IL')}</span>
                </div>
              </div>
              <p className="font-bold text-sm text-red-500 shrink-0">{fmt(tx.amount)}</p>
              <button
                disabled={pending}
                onClick={() => onToggle(tx._id)}
                className="shrink-0 transition-opacity disabled:opacity-50"
                title={tx.isBusiness ? 'הסר מעסקיות' : 'סמן כעסקי'}
              >
                {tx.isBusiness
                  ? <ToggleRight className="h-6 w-6 text-indigo-600" />
                  : <ToggleLeft  className="h-6 w-6 text-slate-300 dark:text-slate-600" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — ניהול עסקים
// ─────────────────────────────────────────────────────────────────────────────
function MerchantsTab({ merchants, loading, search, setSearch, onToggle, pending }) {
  const bizCount = merchants.filter(m => m.isBusiness).length;

  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        סימון עסק כעסקי — מסמן את כל העסקאות שלו אוטומטית.
        {bizCount > 0 && <span className="font-semibold text-indigo-600 mr-1">{bizCount} עסקים מסומנים.</span>}
      </p>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש עסק..."
          className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
        </div>
      ) : !merchants.length ? (
        <p className="text-center text-slate-400 py-12 text-sm">אין עסקים</p>
      ) : (
        <div className="space-y-2">
          {merchants.map(m => (
            <div
              key={m.name}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm border transition-colors ${
                m.isBusiness
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{m.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{m.count} עסקאות · {fmt(m.total)}</p>
              </div>
              {m.isBusiness && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full shrink-0">
                  עסקי
                </span>
              )}
              <button
                disabled={pending}
                onClick={() => onToggle(m.name, m.isBusiness)}
                className="shrink-0 transition-opacity disabled:opacity-50"
              >
                {m.isBusiness
                  ? <ToggleRight className="h-6 w-6 text-indigo-600" />
                  : <ToggleLeft  className="h-6 w-6 text-slate-300 dark:text-slate-600" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3 — סיכום שנתי
// ─────────────────────────────────────────────────────────────────────────────
function SummaryTab({ summary, loading, year, onYearChange }) {
  const { byMonth = [], byCategory = [], yearTotal = 0 } = summary;
  const now = new Date();
  const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe'];

  const monthData = Array.from({ length: 12 }, (_, i) => {
    const key   = `${year}-${String(i + 1).padStart(2, '0')}`;
    const found = byMonth.find(m => m._id === key);
    return { month: MONTHS[i].slice(0, 3), total: found?.total || 0 };
  });

  return (
    <div>
      {/* Year nav */}
      <div className="flex items-center justify-between mb-5 bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
        <button onClick={() => onYearChange(y => y - 1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>
        <div className="text-center">
          <p className="font-bold text-slate-900 dark:text-white">{year}</p>
          {loading
            ? <p className="text-xs text-slate-400">טוען...</p>
            : <p className="text-sm font-semibold text-red-500">{fmt(yearTotal)} סה"כ</p>}
        </div>
        <button
          onClick={() => onYearChange(y => y + 1)}
          disabled={year >= now.getFullYear()}
          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
        </div>
      ) : yearTotal === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">אין הוצאות עסקיות מסומנות לשנה זו</p>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">הוצאות עסקיות לפי חודש</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip formatter={v => [fmt(v), 'הוצאה']} contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.12)' }} />
                  <Bar dataKey="total" radius={[4,4,0,0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {byCategory.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">פירוט לפי קטגוריה</p>
              <div className="space-y-2">
                {byCategory.map((cat, i) => {
                  const pct = yearTotal > 0 ? (cat.total / yearTotal) * 100 : 0;
                  return (
                    <div key={cat._id}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{cat._id || 'כללי'}</span>
                        <span className="text-slate-500">{fmt(cat.total)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
