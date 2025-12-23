// client/src/components/loans/AmortizationTable.jsx

import React from 'react';

const AmortizationTable = ({ schedule }) => {
  console.log('--- טבלת התשלומים נטענת ---');
  console.log('קיבלתי schedule:', schedule);

  if (!schedule || schedule.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log('התאריך של "היום" לצורך השוואה:', today.toISOString());

  const formatCurrency = (num) => `₪${num.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit' });

  return (
    <div className="mt-8 bg-white rounded-lg shadow border overflow-hidden">
      <h3 className="text-lg font-bold p-4 border-b">לוח סילוקין</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          {/* ... thead ... */}
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3">תשלום</th>
              <th className="p-3">תאריך</th>
              <th className="p-3">החזר קרן</th>
              <th className="p-3">החזר ריבית</th>
              <th className="p-3">סה"כ תשלום</th>
              <th className="p-3">יתרה לסילוק</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => {
              const paymentDate = new Date(row.date);
              const isPast = paymentDate < today;

              // הדפסה לכל שורה בטבלה
              console.log(
                `מעבד שורה ${row.paymentNumber}:`,
                `תאריך תשלום: ${paymentDate.toISOString()}`,
                `האם עבר? ${isPast}`
              );

              const rowClass = isPast
                ? 'border-b last:border-b-0 bg-gray-100 text-gray-500'
                : 'border-b last:border-b-0 hover:bg-gray-50';

              return (
                <tr key={row.paymentNumber} className={rowClass}>
                  <td className="p-3">{row.paymentNumber}</td>
                  <td className="p-3">{formatDate(row.date)}</td>
                  <td className="p-3">{formatCurrency(row.principal)}</td>
                  <td className="p-3">{formatCurrency(row.interest)}</td>
                  <td className="p-3 font-semibold">{formatCurrency(row.totalPayment)}</td>
                  <td className="p-3">{formatCurrency(row.remainingBalance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AmortizationTable;