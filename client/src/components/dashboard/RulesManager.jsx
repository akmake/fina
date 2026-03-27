import React, { useState, useMemo, useEffect } from 'react';
import api from '../../utils/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import {
  Trash2, Play, RefreshCw, Plus, Database,
  Zap, Search, ArrowLeft, Tag, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '../ui/label';

const RulesManager = ({ onRulesApplied }) => {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  const [newCatData, setNewCatData] = useState({ name: '', type: 'expense' });
  const [formData, setFormData] = useState({
    searchString: '',
    newName: '',
    categoryId: '',
    matchType: 'contains'
  });

  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, catsRes, transRes] = await Promise.all([
        api.get('/categories/rules/all'),
        api.get('/categories'),
        api.get('/transactions')
      ]);
      setRules(rulesRes.data);
      setCategories(catsRes.data);
      setTransactions(transRes.data);
    } catch (error) {
      toast({ title: 'שגיאה בטעינת נתונים', variant: 'destructive' });
    }
  };

  const uniqueMerchants = useMemo(() => {
    const merchants = new Set();
    transactions.forEach(t => {
      if (t.description) merchants.add(t.description);
      if (t.originalDescription) merchants.add(t.originalDescription);
    });
    return Array.from(merchants).sort();
  }, [transactions]);

  const handleSyncCategories = async () => {
    setSyncLoading(true);
    try {
      const res = await api.post('/categories/sync');
      toast({ title: 'סנכרון הצליח', description: res.data.message });
      fetchData();
    } catch {
      toast({ title: 'שגיאה', description: 'לא ניתן לסנכרן קטגוריות', variant: 'destructive' });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatData.name) return;
    try {
      const res = await api.post('/categories', newCatData);
      setCategories(prev => [...prev, res.data]);
      setIsCatDialogOpen(false);
      setNewCatData({ name: '', type: 'expense' });
      setFormData(prev => ({ ...prev, categoryId: res.data._id }));
      toast({ title: 'קטגוריה נוצרה בהצלחה' });
    } catch (error) {
      toast({ title: 'שגיאה', description: error.response?.data?.message || 'יצירת קטגוריה נכשלה', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.searchString || !formData.categoryId) {
      toast({ title: 'חסרים פרטים', description: 'יש להזין טקסט לחיפוש וקטגוריה', variant: 'destructive' });
      return;
    }
    try {
      const res = await api.post('/categories/rules', formData);
      setRules(prev => [res.data, ...prev]);
      setFormData({ searchString: '', newName: '', categoryId: '', matchType: 'contains' });
      toast({ title: 'החוק נשמר!' });
    } catch {
      toast({ title: 'שגיאה', description: 'לא ניתן לשמור (אולי קיים כבר?)', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/categories/rules/${id}`);
      setRules(prev => prev.filter(r => r._id !== id));
      toast({ title: 'החוק נמחק' });
    } catch {
      toast({ title: 'שגיאה במחיקה', variant: 'destructive' });
    }
  };

  const handleApplyRules = async () => {
    if (!window.confirm('פעולה זו תעבור על כל ההיסטוריה שלך ותעדכן שמות וקטגוריות לפי החוקים. להמשיך?')) return;
    setLoading(true);
    try {
      const res = await api.post('/categories/rules/apply');
      toast({ title: 'הסנכרון הושלם', description: res.data.message });
      if (onRulesApplied) onRulesApplied();
    } catch {
      toast({ title: 'שגיאה', description: 'הסנכרון נכשל', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(r =>
      r.searchString.toLowerCase().includes(q) ||
      (r.newName && r.newName.toLowerCase().includes(q)) ||
      (r.category?.name && r.category.name.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  const selectedCategory = categories.find(c => c._id === formData.categoryId);

  return (
    <div className="space-y-4" dir="rtl">

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* ── RIGHT: New Rule Form ── */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-1.5 rounded-lg">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">חוק חדש</h3>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Search string */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                כאשר שם העסק מכיל
              </label>
              <Input
                list="merchants-list"
                placeholder="לדוגמה: סופרפארם"
                value={formData.searchString}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    searchString: val,
                    newName: prev.newName || val
                  }));
                }}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700"
              />
              <datalist id="merchants-list">
                {uniqueMerchants.map((m, i) => <option key={i} value={m} />)}
              </datalist>
            </div>

            {/* New name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                שנה שם ל
              </label>
              <Input
                placeholder="שם תצוגה נקי"
                value={formData.newName}
                onChange={e => setFormData(prev => ({ ...prev, newName: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                קטגוריה
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  value={formData.categoryId}
                  onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                >
                  <option value="">בחר קטגוריה...</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCatDialogOpen(true)}
                  className="shrink-0 h-9 w-9 border-slate-200 dark:border-slate-700"
                  title="קטגוריה חדשה"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Preview */}
            {formData.searchString && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs">
                  {formData.searchString}
                </span>
                <ArrowLeft className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formData.newName || formData.searchString}
                </span>
                {selectedCategory && (
                  <Badge
                    variant="outline"
                    className="mr-auto text-xs"
                    style={{
                      borderColor: selectedCategory.color,
                      color: selectedCategory.color,
                      backgroundColor: `${selectedCategory.color}15`
                    }}
                  >
                    {selectedCategory.name}
                  </Badge>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10"
            >
              <Zap className="w-4 h-4 ml-2" />
              שמור חוק
            </Button>
          </form>
        </div>

        {/* ── LEFT: Rules List ── */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* List header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="font-semibold text-slate-800 dark:text-slate-100">חוקים פעילים</span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                {filteredRules.length}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-52">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="חיפוש..."
                  className="pr-9 h-8 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-sm rounded-lg"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={handleApplyRules}
                disabled={loading}
                size="sm"
                className="bg-slate-900 hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white rounded-lg h-8 px-3 text-xs shrink-0"
              >
                {loading
                  ? <RefreshCw className="w-3.5 h-3.5 ml-1.5 animate-spin" />
                  : <Play className="w-3.5 h-3.5 ml-1.5" />
                }
                {loading ? 'מעבד...' : 'החל על הכל'}
              </Button>
            </div>
          </div>

          {/* Rules table */}
          {filteredRules.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Zap className="w-7 h-7 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {searchQuery ? 'לא נמצאו תוצאות' : 'עדיין אין חוקים. צור את הראשון →'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRules.map(rule => (
                <div
                  key={rule._id}
                  className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Search term */}
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0 max-w-[120px] truncate" title={rule.searchString}>
                      {rule.searchString}
                    </span>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    {/* Display name */}
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                      {rule.newName || rule.searchString}
                    </span>
                  </div>
                  {/* Category badge */}
                  {rule.category && (
                    <Badge
                      variant="outline"
                      className="shrink-0 text-xs"
                      style={{
                        borderColor: rule.category.color,
                        color: rule.category.color,
                        backgroundColor: `${rule.category.color}15`
                      }}
                    >
                      {rule.category.name}
                    </Badge>
                  )}
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(rule._id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
                    title="מחק"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Categories collapsible section ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div
          onClick={() => setShowCategories(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">
              קטגוריות
            </span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {categories.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setIsCatDialogOpen(true); }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> חדשה
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleSyncCategories(); }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:underline flex items-center gap-1"
              disabled={syncLoading}
            >
              <Database className={`w-3.5 h-3.5 ${syncLoading ? 'animate-bounce' : ''}`} />
              {syncLoading ? 'מסנכרן...' : 'סנכרון'}
            </button>
            {showCategories ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {showCategories && (
          <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            {categories.map(cat => (
              <div
                key={cat._id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium"
                style={{
                  borderColor: cat.color || '#cbd5e1',
                  color: cat.color || '#64748b',
                  backgroundColor: `${cat.color || '#cbd5e1'}12`
                }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color || '#cbd5e1' }}
                />
                {cat.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Category Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Tag className="w-4 h-4 text-blue-500" />
              קטגוריה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">שם</Label>
              <Input
                id="cat-name"
                placeholder="לדוגמה: ביטוחים"
                value={newCatData.name}
                onChange={e => setNewCatData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-type">סוג</Label>
              <select
                id="cat-type"
                value={newCatData.type}
                onChange={e => setNewCatData(prev => ({ ...prev, type: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCatDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleCreateCategory} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5">
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RulesManager;
