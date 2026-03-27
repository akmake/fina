import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, Search, RefreshCw, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/utils/api';
import MerchantDialog from '@/components/transactions/MerchantDialog';
import { formatCurrency } from '@/components/transactions/utils';

export default function MerchantsPage() {
  const [search, setSearch]               = useState('');
  const [sortBy, setSortBy]               = useState('total');
  const [filterRecurring, setFilterRecurring] = useState(false);
  const [months, setMonths]               = useState(12);
  const [expanded, setExpanded]           = useState(null);
  const [dialogMerchant, setDialogMerchant] = useState(null);
  const [dialogCategory, setDialogCategory] = useState(null);

  const { data: merchants = [], isLoading, refetch } = useQuery({
    queryKey: ['merchants-summary', months],
    queryFn: () => api.get(`/transactions/merchants/summary?months=${months}`).then(r => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data),
  });

  const filtered = useMemo(() => {
    let list = merchants;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q)
      );
    }
    if (filterRecurring) list = list.filter(m => m.isRecurring);
    return [...list].sort((a, b) => {
      if (sortBy === 'name')        return a.name.localeCompare(b.name, 'he');
      if (sortBy === 'count')       return b.count - a.count;
      if (sortBy === 'avgPerMonth') return b.avgPerMonth - a.avgPerMonth;
      return b.total - a.total;
    });
  }, [merchants, search, filterRecurring, sortBy]);

  const totalSpent    = merchants.reduce((s, m) => s + m.total, 0);
  const recurringCount = merchants.filter(m => m.isRecurring).length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <Store className="h-6 w-6 text-blue-600" />
        בתי עסק
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{merchants.length}</p>
          <p className="text-xs text-slate-400 mt-1">בתי עסק</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          <p className="text-lg font-bold text-red-500 truncate">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-slate-400 mt-1">סה"כ הוצאות</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          <p className="text-2xl font-bold text-blue-600">{recurringCount}</p>
          <p className="text-xs text-slate-400 mt-1">קבועים</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:text-white focus:outline-none"
        >
          <option value="total">לפי סה"כ</option>
          <option value="count">לפי עסקאות</option>
          <option value="avgPerMonth">לפי ממוצע חודשי</option>
          <option value="name">לפי שם</option>
        </select>
        <select
          value={months}
          onChange={e => setMonths(Number(e.target.value))}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 dark:text-white focus:outline-none"
        >
          <option value={3}>3 חודשים</option>
          <option value={6}>6 חודשים</option>
          <option value={12}>12 חודשים</option>
          <option value={24}>24 חודשים</option>
        </select>
        <button
          onClick={() => setFilterRecurring(f => !f)}
          className={`text-sm px-3 py-2 rounded-xl border transition-colors ${
            filterRecurring
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'
          }`}
        >
          קבועים בלבד
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const isExpanded = expanded === m.name;
            const sortedMonthly = [...(m.monthly || [])].sort((a, b) => a.month.localeCompare(b.month));
            return (
              <div
                key={m.name}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : m.name)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{m.name}</p>
                      {m.isRecurring && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full flex items-center gap-1 shrink-0">
                          <RefreshCw className="h-2.5 w-2.5" /> קבוע
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {m.category && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag className="h-2.5 w-2.5" /> {m.category}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {m.count} עסקאות · {m.monthCount} חודשים
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{formatCurrency(m.total)}</p>
                    <p className="text-[10px] text-slate-400">~{formatCurrency(m.avgPerMonth)}/חודש</p>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-50 dark:border-slate-700">
                    <div className="h-36 mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedMonthly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            tickFormatter={v => v.slice(5)}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                          />
                          <Tooltip
                            formatter={v => [formatCurrency(v), 'הוצאה']}
                            contentStyle={{
                              fontSize: 11,
                              borderRadius: 8,
                              border: 'none',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                            }}
                          />
                          <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <button
                      onClick={() => { setDialogMerchant(m.name); setDialogCategory(m.category); }}
                      className="mt-3 w-full h-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      כל העסקאות
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 py-12 text-sm">לא נמצאו בתי עסק</p>
          )}
        </div>
      )}

      {dialogMerchant && (
        <MerchantDialog
          isOpen={!!dialogMerchant}
          onOpenChange={open => { if (!open) setDialogMerchant(null); }}
          merchantName={dialogMerchant}
          clickedCategory={dialogCategory}
          categories={categories}
          onRefresh={refetch}
          onMerchantChanged={() => { setDialogMerchant(null); refetch(); }}
        />
      )}
    </div>
  );
}
