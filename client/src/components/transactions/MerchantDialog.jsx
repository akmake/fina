import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Edit3, X, Check, Tag, Save, Loader2, CreditCard } from 'lucide-react';
import api from '@/utils/api';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from './utils';

const SOURCE_LABELS = {
  max: 'מקס', visaCal: 'כאל', isracard: 'ישראכרט', amex: 'אמריקן אקספרס',
  hapoalim: 'הפועלים', leumi: 'לאומי', discount: 'דיסקונט', mizrahi: 'מזרחי',
};

export default function MerchantDialog({ isOpen, onOpenChange, merchantName, categories, onRefresh }) {
  const [editCategoryMode, setEditCategoryMode] = useState(false);
  const [selectedNewCategory, setSelectedNewCategory] = useState('');
  const [customCategory, setCustomCategory]     = useState('');
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [editNameMode, setEditNameMode]         = useState(false);
  const [newMerchantName, setNewMerchantName]   = useState('');
  const [merchantHistory, setMerchantHistory]   = useState([]);
  const [loadingHistory, setLoadingHistory]      = useState(false);

  // Fetch ALL transactions for this merchant from server
  useEffect(() => {
    if (!isOpen || !merchantName) { setMerchantHistory([]); return; }
    let cancelled = false;
    setLoadingHistory(true);
    api.get(`/transactions/merchant/${encodeURIComponent(merchantName)}`)
      .then(res => { if (!cancelled) setMerchantHistory(res.data || []); })
      .catch(() => { if (!cancelled) setMerchantHistory([]); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [isOpen, merchantName]);

  const merchantTotal = useMemo(() =>
    merchantHistory.reduce((sum, t) => t.type === 'הכנסה' ? sum + t.amount : sum - t.amount, 0),
    [merchantHistory]
  );

  const currentCategory = merchantHistory[0]?.category || 'כללי';

  // Group card numbers by source (credit card company)
  const cardsBySource = useMemo(() => {
    const map = {};
    merchantHistory.forEach(t => {
      if (!t.cardNumber) return;
      const src = t.source || 'לא ידוע';
      if (!map[src]) map[src] = new Set();
      map[src].add(t.cardNumber);
    });
    return Object.entries(map).map(([source, cards]) => ({
      source,
      label: SOURCE_LABELS[source] || source,
      cards: [...cards],
    }));
  }, [merchantHistory]);

  const handleSaveName = async () => {
    const trimmed = newMerchantName.trim();
    if (!trimmed || trimmed === merchantName) { setEditNameMode(false); return; }
    setUpdatingCategory(true);
    try {
      await api.post('/transactions/merchant-bulk', { originalName: merchantName, newDisplayName: trimmed });
      setEditNameMode(false);
      onOpenChange(false);
      await onRefresh();
    } catch { alert('שגיאה בשינוי השם'); }
    finally { setUpdatingCategory(false); }
  };

  const handleSaveCategory = async () => {
    const isCustom = selectedNewCategory === 'custom';
    const finalCat = isCustom ? customCategory.trim() : selectedNewCategory;
    if (!finalCat) return alert('נא לבחור קטגוריה');

    let catName = finalCat;
    if (!isCustom) {
      const found = categories.find(c => c._id === finalCat);
      if (found) catName = found.name;
    }

    setUpdatingCategory(true);
    try {
      if (isCustom) {
        try { await api.post('/categories', { name: catName, type: 'הוצאה' }); } catch { /* duplicate ok */ }
      }
      await api.post('/transactions/merchant-bulk', { originalName: merchantName, newCategory: catName });
      setEditCategoryMode(false);
      setCustomCategory('');
      setSelectedNewCategory('');
      // Reload merchant history to reflect category change
      try {
        const { data } = await api.get(`/transactions/merchant/${encodeURIComponent(merchantName)}`);
        setMerchantHistory(data || []);
      } catch { /* ignore - will show stale data */ }
      await onRefresh();
    } catch { alert('שגיאה בעדכון הקטגוריה'); }
    finally { setUpdatingCategory(false); }
  };

  const handleClose = () => {
    setEditCategoryMode(false);
    setEditNameMode(false);
    setSelectedNewCategory('');
    setCustomCategory('');
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="rounded-[32px] p-0 overflow-hidden bg-white border-none shadow-2xl flex flex-col max-w-sm sm:max-w-md"
        style={{ maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-5 pt-4 pb-4 shrink-0">
          <button
            onClick={handleClose}
            className="absolute top-3 left-3 h-7 w-7 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>

          {/* Name row */}
          <div className="pr-0 mb-0.5">
            {!editNameMode ? (
              <DialogTitle className="text-[17px] font-bold text-white leading-tight truncate pl-10">
                {merchantName}
              </DialogTitle>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={newMerchantName}
                  onChange={e => setNewMerchantName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1 text-white text-sm outline-none focus:border-white/40"
                  autoFocus
                />
                <button onClick={handleSaveName} className="shrink-0 h-7 w-7 bg-emerald-500/30 hover:bg-emerald-500/50 rounded-full flex items-center justify-center transition-colors">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                </button>
                <button onClick={() => setEditNameMode(false)} className="shrink-0 h-7 w-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                  <X className="h-3 w-3 text-white/60" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <p className="text-white/40 text-[11px] font-medium">{loadingHistory ? '...' : `${merchantHistory.length} עסקאות`}</p>
            {!editNameMode && (
              <button
                onClick={() => { setEditNameMode(true); setNewMerchantName(merchantName); }}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-white/50 hover:text-white/80 transition-colors"
              >
                <Edit3 className="h-3 w-3" /> שנה שם
              </button>
            )}
          </div>

          {/* Total */}
          <div className="flex items-end justify-between">
            <p className={`text-[1.85rem] font-extrabold tracking-tight leading-none ${merchantTotal < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
              {merchantTotal < 0 ? '−' : '+'}{formatCurrency(Math.abs(merchantTotal))}
            </p>
            <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${merchantTotal < 0 ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
              {merchantTotal < 0 ? 'הוצאות' : 'הכנסות'}
            </span>
          </div>

          {/* Card numbers by source */}
          {cardsBySource.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cardsBySource.map(({ label, cards }) => (
                <div key={label} className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
                  <CreditCard className="h-3 w-3 text-white/50" />
                  <span className="text-[10px] font-medium text-white/70">{label}:</span>
                  <span className="text-[10px] font-bold text-white/90">{cards.join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category row */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100/80 shrink-0 flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400">קטגוריה:</span>
          {!editCategoryMode ? (
            <button
              onClick={() => {
                setEditCategoryMode(true);
                const catId = categories.find(c => c.name === currentCategory)?._id || '';
                setSelectedNewCategory(catId);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full px-3 py-1 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm"
            >
              {currentCategory}
              <Edit3 className="h-3 w-3 text-slate-400" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-1">
              <Select value={selectedNewCategory} onValueChange={setSelectedNewCategory}>
                <SelectTrigger className="h-7 text-xs rounded-full flex-1 bg-white border-slate-200">
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                  <SelectItem value="custom" className="text-blue-600 font-bold">+ חדשה...</SelectItem>
                </SelectContent>
              </Select>
              {selectedNewCategory === 'custom' && (
                <Input
                  placeholder="שם..."
                  className="h-7 text-xs rounded-full w-24 bg-white border-slate-200"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                />
              )}
              <Button size="icon" onClick={handleSaveCategory} disabled={updatingCategory} className="h-7 w-7 shrink-0 bg-slate-900 rounded-full hover:bg-slate-700">
                {updatingCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-red-400 rounded-full hover:bg-red-50" onClick={() => setEditCategoryMode(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Transaction list */}
        <div className="overflow-y-auto flex-1 bg-white">
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : merchantHistory.length === 0 ? (
            <p className="text-center text-slate-400 py-12 text-sm">לא נמצאו עסקאות</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {merchantHistory.map((trx, i) => {
                const d = new Date(trx.date);
                const isIncome = trx.type === 'הכנסה';
                const inst = trx.installments;
                return (
                  <div key={i} className="flex items-center gap-3.5 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                    <div className={`h-10 w-10 rounded-2xl flex flex-col items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                      <span className={`text-sm font-bold leading-none ${isIncome ? 'text-emerald-600' : 'text-slate-700'}`}>{format(d, 'dd')}</span>
                      <span className={`text-[9px] font-medium uppercase leading-none mt-0.5 ${isIncome ? 'text-emerald-400' : 'text-slate-400'}`}>{format(d, 'MMM', { locale: he })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-tight">{format(d, 'EEEE', { locale: he })}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-xs text-slate-400">{format(d, 'yyyy')}</span>
                        {trx.cardNumber && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">···{trx.cardNumber}</span>
                        )}
                        {inst?.number && inst?.total && (
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{inst.number}/{inst.total}</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-base font-bold tabular-nums shrink-0 ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {isIncome ? '+' : '−'}{formatCurrency(trx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 pb-5 bg-white border-t border-slate-50 shrink-0">
          <button
            onClick={handleClose}
            className="w-full h-12 rounded-2xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 active:scale-[0.98] transition-all"
          >
            סגור
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
