// client/src/components/dashboard/MonthlySummary.jsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// פונקציית עזר ליצירת כרטיס בודד (הוצאה או הכנסה)
const SummaryCard = ({ title, currentAmount, prevAmount, color, isExpense }) => {
  let changeText = '';
  let changeColor = 'text-gray-500';
  let arrow = '';

  if (prevAmount > 0) {
    const percentChange = ((currentAmount - prevAmount) / prevAmount) * 100;
    arrow = percentChange > 0 ? '▲' : '▼';

    // Invert color logic for expenses (increase is bad)
    if (isExpense) {
      changeColor = percentChange > 0 ? 'text-red-600' : 'text-green-600';
    } else {
      changeColor = percentChange > 0 ? 'text-green-600' : 'text-red-600';
    }
    changeText = `(${Math.abs(percentChange).toFixed(0)}%)`;
  } else if (currentAmount > 0) {
    arrow = '▲';
    changeText = '(חדש)';
    changeColor = isExpense ? 'text-red-600' : 'text-green-600';
  }

  return (
    <Card className={`bg-${color}-50 border-${color}-200`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-base font-bold text-${color}-700`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-extrabold text-${color}-600`}>
          ₪{currentAmount.toLocaleString('he-IL')}
        </p>
        <div className="flex items-center text-sm text-gray-500 mt-1">
          <span>{`חודש קודם: ₪${prevAmount.toLocaleString('he-IL')}`}</span>
          {changeText && (
            <div className={`flex items-center font-semibold mr-2 ${changeColor}`}>
              <span>{arrow}</span>
              <span>{changeText}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const MonthlySummary = ({ data }) => {
  if (!data) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SummaryCard
        title="הוצאות החודש"
        currentAmount={data.thisMonth.expense}
        prevAmount={data.prevMonth.expense}
        color="red"
        isExpense={true}
      />
      <SummaryCard
        title="הכנסות החודש"
        currentAmount={data.thisMonth.income}
        prevAmount={data.prevMonth.income}
        color="green"
        isExpense={false}
      />
    </div>
  );
};