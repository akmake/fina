import { Briefcase, ShoppingBag, Coffee, Home, Car, Zap, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { formatCurrency } from './utils';

export const CategoryIcon = ({ category }) => {
  const c = category?.toLowerCase() || '';
  let Icon = ShoppingBag;
  let colorClass = 'bg-slate-100 text-slate-500';

  if (c.includes('אוכל') || c.includes('מסעדה') || c.includes('מזון'))       { Icon = Coffee;    colorClass = 'bg-orange-100 text-orange-600'; }
  else if (c.includes('בית') || c.includes('שכירות') || c.includes('עיצוב')) { Icon = Home;      colorClass = 'bg-indigo-100 text-indigo-600'; }
  else if (c.includes('רכב') || c.includes('דלק') || c.includes('תחבורה'))   { Icon = Car;       colorClass = 'bg-blue-100 text-blue-600'; }
  else if (c.includes('חשמל') || c.includes('תקשורת') || c.includes('מחשב')) { Icon = Zap;       colorClass = 'bg-yellow-100 text-yellow-600'; }
  else if (c.includes('עבודה') || c.includes('משכורת'))                       { Icon = Briefcase; colorClass = 'bg-emerald-100 text-emerald-600'; }

  return (
    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${colorClass} shadow-sm transition-transform group-hover:scale-105`}>
      <Icon className="h-5 w-5" strokeWidth={2.5} />
    </div>
  );
};

export const TransactionCard = ({ transaction, onClick, onDelete }) => {
  const isExpense = transaction.type === 'הוצאה';
  const sign = isExpense ? '' : '+';
  const isPending = transaction.status === 'pending';
  const inst = transaction.installments;
  const isForeign = transaction.originalCurrency && transaction.originalCurrency !== 'ILS';

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm('למחוק את העסקה?')) onDelete(transaction._id);
  };

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white/80 backdrop-blur-md p-4 rounded-3xl border shadow-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer flex items-center justify-between mb-3 ${isPending ? 'border-amber-200 bg-amber-50/60' : 'border-white/40'}`}
    >
      <div className="flex items-center gap-4">
        <CategoryIcon category={transaction.category} />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-[15px] tracking-tight group-hover:text-blue-600 transition-colors">
              {transaction.description}
            </span>
            {isPending && (
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">
                ממתין
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span className="bg-slate-100 px-2 py-0.5 rounded-md">{transaction.category}</span>
            <span>{format(new Date(transaction.date), 'd בMMM', { locale: he })}</span>
            {inst?.number && inst?.total && (
              <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">
                תשלום {inst.number} מתוך {inst.total}
                {inst.total > 1 && (
                  <span className="text-blue-400 font-normal mr-1">
                    (סה״כ {formatCurrency(transaction.amount * inst.total)})
                  </span>
                )}
              </span>
            )}
            {isForeign && (
              <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">
                {transaction.originalAmount?.toLocaleString()} {transaction.originalCurrency}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-[16px] font-bold tracking-tight ${isExpense ? 'text-slate-900' : 'text-emerald-600'}`}>
          {sign}{formatCurrency(transaction.amount)}
        </span>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500"
          title="מחק עסקה"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
