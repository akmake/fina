import { useMemo } from 'react';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Wallet, ArrowUpRight, ArrowDownLeft, TrendingDown, AlertCircle } from 'lucide-react';
import { formatCurrency } from './utils';

const KpiCard = ({ title, value, icon: Icon, trend }) => (
  <div className="bg-white/60 backdrop-blur-xl p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-white/50 shadow-sm flex flex-col justify-between h-28 sm:h-36 relative overflow-hidden group hover:bg-white/80 transition-all">
    <div className="flex justify-between items-start z-10">
      <span className="text-sm font-semibold text-slate-500">{title}</span>
      <div className="p-2 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
        <Icon className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
      </div>
    </div>
    <div className="z-10">
      <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(value)}</h3>
      {trend && <p className="text-xs text-slate-400 mt-1 font-medium truncate">{trend}</p>}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8 sm:mb-12">
      <KpiCard title="יתרה חודשית"          value={stats.income - stats.expense} icon={Wallet}       trend="מאזן נוכחי" />
      <KpiCard title="הכנסות"               value={stats.income}                 icon={ArrowUpRight}  trend="נכנס לחשבון" />
      <KpiCard title="הוצאות"               value={stats.expense}                icon={ArrowDownLeft} trend="יצא מהחשבון" />
      <KpiCard title="הקטגוריה הבזבזנית"   value={stats.topCategory?.amount || 0} icon={TrendingDown} trend={stats.topCategory?.name || 'אין נתונים'} />
      <KpiCard title="העסקה הגדולה ביותר" value={stats.largestExpense?.amount || 0} icon={AlertCircle} trend={stats.largestExpense?.description || 'אין נתונים'} />
    </div>
  );
}
