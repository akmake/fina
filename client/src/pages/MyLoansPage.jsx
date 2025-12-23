// client/src/pages/MyLoansPage.jsx

import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
// --- 👇 השינוי כאן: מייבאים את הרכיב החדש שיצרנו 👇 ---
import LoanSummaryCard from '@/components/loans/LoanSummaryCard';

const MyLoansPage = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/loans');
        setLoans(data);
      } catch (err) {
        setError('שגיאה בטעינת ההלוואות.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLoans();
  }, []);

  if (loading) return <div className="text-center p-10">טוען נתונים...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ההלוואות שלי</h1>
        <Button asChild>
          <Link to="/loans/new">הוסף הלוואה חדשה</Link>
        </Button>
      </div>
      
      {loans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* --- 👇 השינוי כאן: משתמשים ברכיב החדש במקום להציג סתם טקסט 👇 --- */}
          {loans.map(loan => (
            <LoanSummaryCard key={loan._id} loan={loan} />
          ))}
        </div>
      ) : (
        <div className="text-center p-10 bg-gray-50 rounded-lg">
          <p>עדיין לא הוספת הלוואות למעקב.</p>
        </div>
      )}
    </div>
  );
};

export default MyLoansPage;