import { useMemo } from 'react';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Wallet, ArrowUpRight, ArrowDownLeft, TrendingDown, AlertCircle } from 'lucide-react';
import { formatCurrency } from './utils';

const KpiCard = ({ title, value, icon: Icon, trend }) => (
  <div className="min-w-0 bg-white p-4 sm:p-5 border-b sm:border-b-0 sm:border-l last:border-0 border-slate-100 dark:border-white/[0.07] dark:bg-[#15181f]">
    <div className="flex justify-between items-start z-10">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{title}</span>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/[0.06]">
        <Icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
      </div>
    </div>
    <div className="z-10">
      <h3 className="truncate text-xl font-bold text-slate-950 dark:text-white tracking-tight">{formatCurrency(value)}</h3>
      {trend && <p className="text-[10px] text-slate-400 mt-1 truncate">{trend}</p>}
    </div>
  </div>
);

export default function KpiBar({ transactions, effectiveMonth }) {
  const stats = useMemo(() => {
    const start = startOfMonth(effectiveMonth);
    const end   = endOfMonth(effectiveMonth);
    const relevant = transactions.filter(t =>
      isWithinInterval(new Date(t.date), { start, end })
    );

    let income = 0, expense = 0, largestExpense = null;
    const categorySums = {};

    relevant.forEach(t => {
      if (t.type === 'הכנסה') {
        income += t.amount;
      } else {
        expense += t.amount;
        if (!largestExpense || t.amount > largestExpense.amount) largestExpense = t;
        if (t.category) categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
      }
    });

    let topCategory = null, maxAmt = 0;
    Object.entries(categorySums).forEach(([cat, amt]) => {
      if (amt > maxAmt) { maxAmt = amt; topCategory = { name: cat, amount: amt }; }
    });

    return { income, expense, largestExpense, topCategory };
  }, [transactions, effectiveMonth]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#15181f] mb-6">
      <KpiCard title="יתרה חודשית"          value={stats.income - stats.expense} icon={Wallet}       trend="מאזן נוכחי" />
      <KpiCard title="הכנסות"               value={stats.income}                 icon={ArrowUpRight}  trend="נכנס לחשבון" />
      <KpiCard title="הוצאות"               value={stats.expense}                icon={ArrowDownLeft} trend="יצא מהחשבון" />
      <KpiCard title="הקטגוריה הבזבזנית"   value={stats.topCategory?.amount || 0} icon={TrendingDown} trend={stats.topCategory?.name || 'אין נתונים'} />
      <KpiCard title="העסקה הגדולה ביותר" value={stats.largestExpense?.amount || 0} icon={AlertCircle} trend={stats.largestExpense?.description || 'אין נתונים'} />
    </div>
  );
}
