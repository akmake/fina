import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import { Trash2, Play, Save, RefreshCw, Plus, Database } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const RulesManager = ({ onRulesApplied }) => {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  
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
      const [rulesRes, catsRes] = await Promise.all([
        api.get('/categories/rules/all'),
        api.get('/categories')
      ]);
      setRules(rulesRes.data);
      setCategories(catsRes.data);
    } catch (error) {
      console.error(error);
      toast({ title: 'שגיאה בטעינת נתונים', variant: 'destructive' });
    }
  };

  const handleSyncCategories = async () => {
      setSyncLoading(true);
      try {
          const res = await api.post('/categories/sync');
          toast({ title: 'סנכרון הצליח', description: res.data.message });
          fetchData(); // רענון הרשימה
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
          // אם המשתמש היה באמצע יצירת חוק, נבחר לו את הקטגוריה החדשה אוטומטית
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
      setRules([...rules, res.data]);
      setFormData({ searchString: '', newName: '', categoryId: '', matchType: 'contains' }); 
      toast({ title: 'החוק נשמר בהצלחה' });
    } catch (error) {
      toast({ title: 'שגיאה', description: 'לא ניתן לשמור את החוק (אולי הוא כבר קיים?)', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/categories/rules/${id}`);
      setRules(rules.filter(r => r._id !== id));
    } catch (error) {
      console.error(error);
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

  return (
    <div className="space-y-6 dir-rtl">
      <Card>
        <CardHeader>
            <CardTitle className="flex flex-col md:flex-row justify-between items-center gap-4">
                <span>מנוע חוקים ונרמול שמות</span>
                <div className="flex gap-2">
                    <Button onClick={handleSyncCategories} disabled={syncLoading} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                        <Database className={`w-4 h-4 ml-2 ${syncLoading ? 'animate-bounce' : ''}`} />
                        {syncLoading ? 'טוען קטגוריות...' : 'טען קטגוריות ברירת מחדל'}
                    </Button>
                    <Button onClick={handleApplyRules} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Play className="w-4 h-4 ml-2" />}
                        {loading ? 'מעבד נתונים...' : 'החל חוקים על היסטוריה'}
                    </Button>
                </div>
            </CardTitle>
        </CardHeader>
        <CardContent>
            {/* טופס הוספה */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6 p-4 bg-gray-50 rounded-lg border">
                <div className="md:col-span-3">
                    <Label>אם הטקסט המקורי מכיל:</Label>
                    <Input 
                        placeholder="לדוגמה: פז" 
                        value={formData.searchString}
                        onChange={e => setFormData({...formData, searchString: e.target.value})}
                    />
                </div>
                <div className="md:col-span-3">
                    <Label>שנה את השם לתצוגה ל:</Label>
                    <Input 
                        placeholder="לדוגמה: פז (נקי)" 
                        value={formData.newName}
                        onChange={e => setFormData({...formData, newName: e.target.value})}
                    />
                </div>
                <div className="md:col-span-3">
                    <div className="flex justify-between items-center mb-1">
                        <Label>שייך לקטגוריה:</Label>
                        <span 
                            onClick={() => setIsCatDialogOpen(true)} 
                            className="text-xs text-blue-600 cursor-pointer hover:underline flex items-center"
                        >
                            <Plus className="w-3 h-3 ml-1" />
                            חדשה
                        </span>
                    </div>
                    <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={formData.categoryId}
                        onChange={e => setFormData({...formData, categoryId: e.target.value})}
                    >
                        <option value="">בחר קטגוריה...</option>
                        {categories.map(cat => (
                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-3">
                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
                        <Save className="w-4 h-4 ml-2" />
                        שמור חוק חדש
                    </Button>
                </div>
            </form>

            {/* טבלה */}
            <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100 text-gray-700 border-b">
                        <tr>
                            <th className="p-3">טקסט לחיפוש (במקור)</th>
                            <th className="p-3">שם חדש (נרמול)</th>
                            <th className="p-3">קטגוריה</th>
                            <th className="p-3">פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500">עדיין לא הגדרת חוקים. צור חוק ראשון למעלה!</td></tr>
                        ) : (
                            rules.map(rule => (
                                <tr key={rule._id} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="p-3 font-medium text-gray-900">{rule.searchString}</td>
                                    <td className="p-3 text-gray-600">{rule.newName || '(ללא שינוי שם)'}</td>
                                    <td className="p-3">
                                        <span 
                                            className="px-2 py-1 rounded-full text-xs text-white shadow-sm" 
                                            style={{ backgroundColor: rule.category?.color || '#999' }}
                                        >
                                            {rule.category?.name || 'קטגוריה נמחקה'}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <Button 
                                            variant="ghost" 
                                            size="icon"
                                            onClick={() => handleDelete(rule._id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </CardContent>
      </Card>

      {/* דיאלוג יצירת קטגוריה חדשה */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>יצירת קטגוריה חדשה</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                שם
              </Label>
              <Input
                id="name"
                value={newCatData.name}
                onChange={(e) => setNewCatData({...newCatData, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                סוג
              </Label>
              <select
                id="type"
                value={newCatData.type}
                onChange={(e) => setNewCatData({...newCatData, type: e.target.value})}
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateCategory}>שמור קטגוריה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RulesManager;