// client/src/pages/LoanDetailPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '@/utils/api';
import AmortizationTable from '@/components/loans/AmortizationTable';

const LoanDetailPage = () => {
  const { loanId } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLoan = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/loans/${loanId}`);
        setLoan(data);
      } catch (err) {
        setError('שגיאה בטעינת פרטי ההלוואה.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLoan();
  }, [loanId]);

  // --- 👇 This is the new calculation block 👇 ---
  // It calculates the progress only when the 'loan' data changes.
  const progressData = useMemo(() => {
    if (!loan) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastPayments = loan.amortizationSchedule.filter(p => new Date(p.date) < today);
    
    const paidPrincipal = pastPayments.reduce((sum, p) => sum + p.principal, 0);
    const paidInterest = pastPayments.reduce((sum, p) => sum + p.interest, 0);
    const totalPaid = paidPrincipal + paidInterest;
    
    const lastPaidPayment = pastPayments[pastPayments.length - 1];
    const currentBalance = lastPaidPayment ? lastPaidPayment.remainingBalance : loan.principal;
    
    const progressPercentage = (paidPrincipal / loan.principal) * 100;

    return { paidPrincipal, totalPaid, currentBalance, progressPercentage };
  }, [loan]);

  if (loading) return <div className="text-center p-10">טוען פרטי הלוואה...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
  if (!loan || !progressData) return <div className="text-center p-10">ההלוואה לא נמצאה.</div>;

  const formatCurrency = (num) => (num || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Link to="/my-loans" className="text-blue-600 hover:underline">
        &larr; חזרה לכל ההלוואות
      </Link>
      
      <div className="bg-white p-6 rounded-lg shadow border">
        <h1 className="text-2xl font-bold">{loan.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div><span className="font-semibold text-gray-600">סכום מקורי:</span> {formatCurrency(loan.principal)} ₪</div>
          <div><span className="font-semibold text-gray-600">ריבית התחלתית:</span> {loan.interestRate.primeRateOnStart}%</div>
          <div><span className="font-semibold text-gray-600">תקופה:</span> {loan.termInMonths} חודשים</div>
          <div><span className="font-semibold text-gray-600">שיטת החזר:</span> {loan.repaymentType}</div>
        </div>
      </div>

      {/* --- 👇 This is the new summary section 👇 --- */}
      <div className="bg-white p-6 rounded-lg shadow border space-y-4">
        <h2 className="text-xl font-bold">התקדמות ההלוואה (נכון להיום)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><span className="font-semibold text-gray-600">יתרה נוכחית לסילוק:</span> {formatCurrency(progressData.currentBalance)} ₪</div>
          <div><span className="font-semibold text-gray-600">סה"כ שולם עד כה:</span> {formatCurrency(progressData.totalPaid)} ₪</div>
          <div><span className="font-semibold text-gray-600">התקדמות החזר הקרן:</span> {progressData.progressPercentage.toFixed(1)}%</div>
        </div>
      </div>

      <AmortizationTable schedule={loan.amortizationSchedule} />
    </div>
  );
};

export default LoanDetailPage;