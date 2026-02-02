import { useEffect, useState, useMemo } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/Button';
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Landmark, PiggyBank, BarChart, ArrowRightLeft, PlusCircle } from 'lucide-react';

const ACCOUNTS = {
  checking: { label: "עו״ש", icon: Landmark },
  cash: { label: "מזומן", icon: Wallet },
  deposits: { label: "פיקדונות", icon: PiggyBank },
  stocks: { label: "מניות", icon: BarChart },
};

// קומפוננטת עזר לכרטיס סטטיסטיקה
const StatCard = ({ title, value, icon: Icon, loading }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-3/4" />
      ) : (
        <div className="text-2xl font-bold">
          {(value || 0).toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0 })}
        </div>
      )}
    </CardContent>
  </Card>
);

// ✅ שם הקומפוננטה שונה ל-FinancePage
function FinancePage() {
  const { profile, loading, error, fetchProfile, updateProfile } = useFinanceStore();
  const [addAmt, setAddAmt] = useState("");
  const [addAcc, setAddAcc] = useState("cash");
  const [from, setFrom] = useState("checking");
  const [to, setTo] = useState("cash");
  const [trxAmt, setTrxAmt] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const total = useMemo(() => {
    if (!profile) return 0;
    return Object.keys(ACCOUNTS).reduce((sum, key) => sum + (profile[key] || 0), 0);
  }, [profile]);

  const handleAdd = async () => {
    const amount = Number(addAmt);
    if (!amount || !profile) return;
    await updateProfile({
      ...profile,
      [addAcc]: (profile[addAcc] || 0) + amount
    });
    setAddAmt("");
  };

  const handleTransfer = async () => {
    const amount = Number(trxAmt);
    if (!amount || from === to || !profile || (profile[from] || 0) < amount) {
      alert("סכום לא חוקי, חשבונות זהים או יתרה לא מספקת");
      return;
    }
    await updateProfile({
      ...profile,
      [from]: (profile[from] || 0) - amount,
      [to]: (profile[to] || 0) + amount,
    });
    setTrxAmt("");
  };

  if (error) return <p className="p-6 text-center text-red-600">שגיאה: {error}</p>;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">ניהול פיננסי</h1>
        <p className="mt-2 text-lg text-gray-600">סקירה וניהול של כל הנכסים שלך.</p>
      </header>

      <section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Object.entries(ACCOUNTS).map(([key, { label, icon }]) => (
            <StatCard key={key} title={label} value={profile?.[key]} icon={icon} loading={loading} />
          ))}
          <StatCard title="סה״כ נכסים" value={total} icon={Wallet} loading={loading} />
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5" /> הוספת סכום</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={addAcc} onValueChange={setAddAcc}>
              <SelectTrigger><SelectValue placeholder="בחר חשבון" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="סכום"
              value={addAmt}
              onChange={(e) => setAddAmt(e.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleAdd} disabled={!addAmt}>הוסף</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> העברה בין חשבונות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger><SelectValue placeholder="מחשבון" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">→</span>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="לחשבון" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              placeholder="סכום"
              value={trxAmt}
              onChange={(e) => setTrxAmt(e.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleTransfer} disabled={!trxAmt}>העבר</Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}

// ✅ שינוי צורת הייצוא לשורה נפרדת בסוף הקובץ
export default FinancePage;
