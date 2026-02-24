// client/src/components/loans/LoanSummaryCard.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const LoanSummaryCard = ({ loan }) => {
  const formatCurrency = (num) => `₪${(num || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- 👇 השינוי המרכזי כאן 👇 ---
  // מחשבים את היתרה הנוכחית בדיוק כמו בעמוד הפירוט
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastPayments = loan.amortizationSchedule.filter(p => new Date(p.date) < today);
  const lastPaidPayment = pastPayments[pastPayments.length - 1];
  const currentBalance = lastPaidPayment ? lastPaidPayment.remainingBalance : loan.principal;
  // --- סוף השינוי ---

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border dark:border-slate-800 flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-base sm:text-lg dark:text-slate-100">{loan.name}</h3>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">סכום מקורי: {formatCurrency(loan.principal)}</p>
        {/* מציגים את היתרה העדכנית שחישבנו */}
        <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">יתרה נוכחית לסילוק: <span className="font-semibold">{formatCurrency(currentBalance)}</span></p>
      </div>
      <div className="pt-2 mt-2">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/loans/${loan._id}`}>צפה בפרטים</Link>
        </Button>
      </div>
    </div>
  );
};

export default LoanSummaryCard;