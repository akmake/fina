import { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CREATE_NEW_CATEGORY_VALUE } from './utils';

export default function AddTransactionForm({ categories, onAdd, onCategoryCreated }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'הוצאה',
    category: '',
    account: 'checking',
  });
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleFormChange = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const handleCategoryChange = (value) => {
    if (value === CREATE_NEW_CATEGORY_VALUE) setIsCategoryDialogOpen(true);
    else setForm(prev => ({ ...prev, category: value }));
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const { data: newCat } = await api.post('/categories', { name: newCategoryName.trim(), type: 'הוצאה' });
      onCategoryCreated(newCat);
      setForm(prev => ({ ...prev, category: newCat._id }));
      setIsCategoryDialogOpen(false);
      setNewCategoryName('');
    } catch { alert('שגיאה ביצירת קטגוריה'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) { alert('נא לבחור קטגוריה.'); return; }
    try {
      const categoryName = categories.find(c => c._id === form.category)?.name || 'כללי';
      await api.post('/transactions', { ...form, category: categoryName });
      onAdd();
      setForm({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), type: 'הוצאה', category: '', account: 'checking' });
    } catch { alert('שגיאה בהוספת העסקה'); }
  };

  return (
    <>
      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] shadow-sm border border-white/60 lg:sticky lg:top-28">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/20">
            <Plus className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-slate-900">פעולה חדשה</h3>
            <p className="text-sm text-slate-500">הוסף הוצאה או הכנסה</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 mr-2">תיאור</label>
            <Input
              className="h-14 bg-white border-transparent focus:border-slate-200 rounded-3xl shadow-sm text-lg px-6"
              placeholder="מה קנינו?"
              value={form.description}
              onChange={e => handleFormChange('description', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 mr-2">סכום</label>
              <Input
                className="h-14 bg-white border-transparent focus:border-slate-200 rounded-3xl shadow-sm text-lg px-6 font-mono"
                type="number" placeholder="0.00"
                value={form.amount}
                onChange={e => handleFormChange('amount', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 mr-2">תאריך</label>
              <Input
                className="h-14 bg-white border-transparent focus:border-slate-200 rounded-3xl shadow-sm px-4 text-sm"
                type="date"
                value={form.date}
                onChange={e => handleFormChange('date', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 mr-2">קטגוריה</label>
            <Select value={form.category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="h-14 bg-white border-transparent rounded-3xl shadow-sm px-6 text-slate-600">
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent className="rounded-3xl">
                {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                <SelectItem value={CREATE_NEW_CATEGORY_VALUE} className="text-blue-600 font-bold">+ קטגוריה חדשה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <Select value={form.type} onValueChange={v => handleFormChange('type', v)}>
              <SelectTrigger className="h-12 rounded-3xl border-transparent bg-slate-100 shadow-inner"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="הוצאה">הוצאה</SelectItem>
                <SelectItem value="הכנסה">הכנסה</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.account} onValueChange={v => handleFormChange('account', v)}>
              <SelectTrigger className="h-12 rounded-3xl border-transparent bg-slate-100 shadow-inner"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="checking">עו&quot;ש</SelectItem>
                <SelectItem value="cash">מזומן</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full h-14 rounded-3xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg shadow-xl shadow-slate-900/10 mt-4 transition-transform active:scale-95"
          >
            שמור
          </Button>
        </form>
      </div>

      {/* New category dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="rounded-[32px] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">קטגוריה חדשה</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <Input
              className="h-14 rounded-3xl bg-slate-50 border-transparent text-center text-lg"
              placeholder="שם הקטגוריה..."
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveNewCategory} className="w-full h-12 rounded-3xl bg-slate-900 font-bold hover:bg-slate-800">
              שמור קטגוריה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
