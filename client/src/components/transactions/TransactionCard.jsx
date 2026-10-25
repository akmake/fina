import { Briefcase, ShoppingBag, Coffee, Home, Car, Zap, Trash2, CreditCard, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { formatCurrency } from './utils';

const ILS_CODES = ['ILS', '₪', 'ש"ח', 'שח', 'NIS', 'שקל'];

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
    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${colorClass} flex-shrink-0`}>
      <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
    </div>
  );
};

export const TransactionCard = ({ transaction, onClick, onDelete, onEdit }) => {
  const isExpense = transaction.type === 'הוצאה';
  const sign = isExpense ? '' : '+';
  const isPending = transaction.status === 'pending';
  const inst = transaction.installments;
  const isForeign = transaction.originalCurrency && !ILS_CODES.includes(transaction.originalCurrency);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm('למחוק את העסקה?')) onDelete(transaction._id);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(transaction);
  };

  return (
    <div onClick={onClick} className={`group relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center border-b px-4 py-3 transition-colors md:grid-cols-[minmax(260px,1.5fr)_minmax(130px,.7fr)_minmax(110px,.5fr)_120px] ${isPending ? 'border-amber-100 bg-amber-50/60 dark:bg-amber-500/[0.06]' : 'border-[#eee9df] hover:bg-[#faf7f1] dark:border-white/[0.06] dark:hover:bg-white/[0.03]'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon category={transaction.category} />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-slate-900 dark:text-slate-100 text-[13px] tracking-tight">
              {transaction.description}
            </span>
            {isPending && (
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md">
                ממתין
              </span>
            )}
          </div>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400 md:hidden">
            <span>{transaction.category}</span><span>·</span><span>{format(new Date(transaction.date), 'd בMMM', { locale: he })}</span>
            {transaction.cardNumber && (
              <span className="text-slate-400 flex items-center gap-0.5">
                <CreditCard className="h-3 w-3" />···{transaction.cardNumber}
              </span>
            )}
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

      <span className="hidden text-[11px] font-medium text-slate-500 md:block">{transaction.category}</span>
      <span className="hidden text-[11px] text-slate-400 md:block">{format(new Date(transaction.date), 'd בMMMM', { locale: he })}</span>

      <div className="mr-3 flex flex-shrink-0 items-center justify-end gap-1">
        <span className={`text-[13px] font-semibold tracking-tight ${isExpense ? 'text-slate-900 dark:text-slate-100' : 'text-emerald-600'}`}>
          {sign}{formatCurrency(transaction.amount)}
        </span>
        <button
          onClick={handleEdit}
          className="opacity-0 focus:opacity-100 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500 dark:hover:bg-blue-500/10"
          title="ערוך עסקה"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={handleDelete}
          className="opacity-0 focus:opacity-100 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 dark:hover:bg-red-500/10"
          title="מחק עסקה"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
