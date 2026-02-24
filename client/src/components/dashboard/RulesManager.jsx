import React, { useState, useMemo, useEffect } from 'react';
import api from '../../utils/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { 
  Trash2, Play, Save, RefreshCw, Plus, Database, 
  Bot, Zap, Search, ArrowLeft, Tag, Sparkles
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const RulesManager = ({ onRulesApplied }) => {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // טופס קטגוריה חדשה
  const [newCatData, setNewCatData] = useState({ name: '', type: 'expense' });

  // טופס חוק חדש
  const [formData, setFormData] = useState({
    searchString: '',
    newName: '',
    categoryId: '',
    matchType: 'contains'
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

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
      console.error(error);
      toast({ title: 'שגיאה בטעינת נתונים', variant: 'destructive' });
    }
  };

  // חילוץ רשימת בתי עסק ייחודיים מהעסקאות
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
      } catch (error) {
          toast({ title: 'שגיאה', description: 'לא ניתן לסנכרן קטגוריות', variant: 'destructive' });
      } finally {
          setSyncLoading(false);
      }
  };

  const handleCreateCategory = async () => {
      if (!newCatData.name) return;
      try {
          const res = await api.post('/categories', newCatData);
          setCategories([...categories, res.data]);
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
      setRules([res.data, ...rules]);
      setFormData({ searchString: '', newName: '', categoryId: '', matchType: 'contains' }); 
      toast({ title: 'האוטומציה נשמרה בהצלחה!', description: 'היא תופעל אוטומטית בייבוא הבא.' });
    } catch (error) {
      toast({ title: 'שגיאה', description: 'לא ניתן לשמור את החוק (אולי הוא כבר קיים?)', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/categories/rules/${id}`);
      setRules(rules.filter(r => r._id !== id));
      toast({ title: 'האוטומציה נמחקה' });
    } catch (error) {
      console.error(error);
      toast({ title: 'שגיאה במחיקה', variant: 'destructive' });
    }
  };

  const handleApplyRules = async () => {
    if (!window.confirm('פעולה זו תעבור על כל ההיסטוריה שלך ותעדכן שמות וקטגוריות לפי החוקים. להמשיך?')) return;
    
    setLoading(true);
    try {
      const res = await api.post('/categories/rules/apply');
      toast({ title: 'תהליך הסנכרון הושלם', description: res.data.message });
      if (onRulesApplied) onRulesApplied(); 
    } catch (error) {
      toast({ title: 'שגיאה', description: 'הסנכרון נכשל', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules;
    const lowerQ = searchQuery.toLowerCase();
    return rules.filter(r => 
      r.searchString.toLowerCase().includes(lowerQ) || 
      (r.newName && r.newName.toLowerCase().includes(lowerQ)) ||
      (r.category?.name && r.category.name.toLowerCase().includes(lowerQ))
    );
  }, [rules, searchQuery]);

  return (
    <div className="space-y-6 dir-rtl">
      
      <Tabs defaultValue="rules" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="rules" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-400 px-6">
              <Zap className="w-4 h-4 ml-2" />
              חוקים אוטומטיים
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-400 px-6">
              <Tag className="w-4 h-4 ml-2" />
              ניהול קטגוריות
            </TabsTrigger>
          </TabsList>

          <Button onClick={handleApplyRules} disabled={loading} className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-full shadow-md transition-all">
            {loading ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Play className="w-4 h-4 ml-2" />}
            {loading ? 'מעבד נתונים...' : 'החל חוקים על כל ההיסטוריה'}
          </Button>
        </div>

        <TabsContent value="rules" className="space-y-8 mt-0 focus-visible:outline-none focus-visible:ring-0">
          
          {/* Smart Rule Creator */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800/50 dark:to-slate-900/50 p-6 md:p-8 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">צור אוטומציה חדשה</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col md:flex-row md:items-center gap-3 text-slate-700 dark:text-slate-300 text-lg font-medium">
                <span>כאשר שם העסק מכיל את המילה</span>
                <div className="relative w-full md:w-64">
                  <Input 
                    list="merchants-list"
                    className="w-full bg-white dark:bg-slate-950 border-blue-200 dark:border-slate-600 focus-visible:ring-blue-500 text-lg h-12 shadow-sm"
                    placeholder="בחר או הקלד שם עסק..." 
                    value={formData.searchString}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev, 
                        searchString: val,
                        newName: prev.newName || val
                      }));
                    }}
                  />
                  <datalist id="merchants-list">
                    {uniqueMerchants.map((merchant, idx) => (
                      <option key={idx} value={merchant} />
                    ))}
                  </datalist>
                </div>
                <span className="hidden md:inline">,</span>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center gap-3 text-slate-700 dark:text-slate-300 text-lg font-medium">
                <span>שנה את השם ל-</span>
                <Input 
                  className="w-full md:w-64 bg-white dark:bg-slate-950 border-blue-200 dark:border-slate-600 focus-visible:ring-blue-500 text-lg h-12 shadow-sm"
                  placeholder="לדוגמה: תחנת דלק פז" 
                  value={formData.newName}
                  onChange={e => setFormData({...formData, newName: e.target.value})}
                />
                <span className="hidden md:inline">,</span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3 text-slate-700 dark:text-slate-300 text-lg font-medium">
                <span>ושייך אוטומטית לקטגוריה</span>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select 
                      className="flex h-12 w-full md:w-64 rounded-md border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shadow-sm"
                      value={formData.categoryId}
                      onChange={e => setFormData({...formData, categoryId: e.target.value})}
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
                      className="shrink-0 h-12 w-12 border-blue-200 text-blue-600 hover:bg-blue-100 dark:border-slate-600 dark:text-blue-400 dark:hover:bg-slate-800 shadow-sm"
                      title="צור קטגוריה חדשה"
                  >
                      <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <span className="hidden md:inline">.</span>
              </div>

              <div className="mt-4 flex justify-end">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 text-lg rounded-full shadow-md hover:shadow-lg transition-all">
                  <Zap className="w-5 h-5 ml-2" />
                  הפעל אוטומציה
                </Button>
              </div>
            </form>
          </div>

          {/* Rules List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                אוטומציות פעילות 
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full px-3">
                  {filteredRules.length}
                </Badge>
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="חפש חוק אוטומציה..." 
                  className="pr-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-full shadow-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRules.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">אין אוטומציות פעילות</h4>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {searchQuery ? 'לא נמצאו תוצאות לחיפוש שלך.' : 'צור את האוטומציה הראשונה שלך למעלה ותן למערכת לעבוד בשבילך!'}
                  </p>
                </div>
              ) : (
                filteredRules.map(rule => (
                  <div key={rule._id} className="group flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 p-3 rounded-xl text-blue-600 dark:text-blue-400 shadow-inner">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span>מזהה:</span>
                          <strong className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-xs border border-slate-200 dark:border-slate-700">
                            "{rule.searchString}"
                          </strong>
                        </div>
                        <div className="flex items-center flex-wrap gap-2 font-medium text-slate-900 dark:text-slate-100">
                          <ArrowLeft className="w-4 h-4 text-slate-400" />
                          <span className="text-base">{rule.newName || rule.searchString}</span>
                          <Badge variant="outline" style={{ borderColor: rule.category?.color, color: rule.category?.color, backgroundColor: `${rule.category?.color}10` }} className="ml-2">
                            {rule.category?.name || 'ללא קטגוריה'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(rule._id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-opacity shrink-0"
                      title="מחק אוטומציה"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6 mt-0 focus-visible:outline-none focus-visible:ring-0">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-500" />
                    קטגוריות במערכת
                  </CardTitle>
                  <CardDescription className="mt-1">
                    נהל את הקטגוריות המשמשות לסיווג העסקאות שלך
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setIsCatDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                    <Plus className="w-4 h-4 ml-2" />
                    קטגוריה חדשה
                  </Button>
                  <Button onClick={handleSyncCategories} disabled={syncLoading} variant="outline" className="rounded-full border-slate-200 dark:border-slate-700">
                    <Database className={`w-4 h-4 ml-2 ${syncLoading ? 'animate-bounce' : ''}`} />
                    {syncLoading ? 'מסנכרן...' : 'סנכרון ברירת מחדל'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6">
                {categories.map(cat => (
                  <div key={cat._id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm hover:shadow-md transition-all">
                    <div 
                      className="w-4 h-4 rounded-full shrink-0 shadow-inner" 
                      style={{ backgroundColor: cat.color || '#cbd5e1' }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate" title={cat.name}>
                      {cat.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* דיאלוג יצירת קטגוריה חדשה */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-500" />
              יצירת קטגוריה חדשה
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right font-medium">
                שם הקטגוריה
              </Label>
              <Input
                id="name"
                placeholder="לדוגמה: ביטוחים"
                value={newCatData.name}
                onChange={(e) => setNewCatData({...newCatData, name: e.target.value})}
                className="col-span-3 h-10"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right font-medium">
                סוג תנועה
              </Label>
              <select
                id="type"
                value={newCatData.type}
                onChange={(e) => setNewCatData({...newCatData, type: e.target.value})}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateCategory} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
              שמור קטגוריה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RulesManager;
