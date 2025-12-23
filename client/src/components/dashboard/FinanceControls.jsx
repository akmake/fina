// client/src/components/dashboard/FinanceControls.jsx
import { useState, useEffect } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import toast from 'react-hot-toast';

export const FinanceControls = () => {
  const { profile, fetchProfile, updateProfile, loading } = useFinanceStore();
  const [balances, setBalances] = useState({
    checking: 0,
    cash: 0,
    deposits: 0,
    stocks: 0,
  });

  // טעינת הנתונים הראשונית מהשרת
  useEffect(() => {
    if (!profile) {
      fetchProfile();
    }
  }, [profile, fetchProfile]);

  // עדכון הטופס כשהנתונים מהשרת מגיעים
  useEffect(() => {
    if (profile) {
      setBalances({
        checking: profile.checking || 0,
        cash: profile.cash || 0,
        deposits: profile.deposits || 0,
        stocks: profile.stocks || 0,
      });
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBalances(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericBalances = {
      checking: Number(balances.checking),
      cash: Number(balances.cash),
      deposits: Number(balances.deposits),
      stocks: Number(balances.stocks),
    };
    await updateProfile(numericBalances);
    toast.success('היתרות עודכנו בהצלחה!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>עדכון יתרות בחשבונות</CardTitle>
        <CardDescription>הזן כאן את היתרות העדכניות שלך בחשבונות השונים.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="checking" className="block text-sm font-medium text-gray-700">עו"ש</label>
              <Input type="number" name="checking" id="checking" value={balances.checking} onChange={handleChange} className="mt-1" />
            </div>
            <div>
              <label htmlFor="cash" className="block text-sm font-medium text-gray-700">מזומן</label>
              <Input type="number" name="cash" id="cash" value={balances.cash} onChange={handleChange} className="mt-1" />
            </div>
            <div>
              <label htmlFor="deposits" className="block text-sm font-medium text-gray-700">פקדונות</label>
              <Input type="number" name="deposits" id="deposits" value={balances.deposits} onChange={handleChange} className="mt-1" />
            </div>
            <div>
              <label htmlFor="stocks" className="block text-sm font-medium text-gray-700">השקעות</label>
              <Input type="number" name="stocks" id="stocks" value={balances.stocks} onChange={handleChange} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'מעדכן...' : 'שמור שינויים'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};