import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/Button';
import LoanSummaryCard from '@/components/loans/LoanSummaryCard';
import { Loader2, CreditCard, PlusCircle } from 'lucide-react';

export default function MyLoansPage() {
  const [loans,   setLoans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

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

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-8 space-y-6 sm:space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">ההלוואות שלי</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">מעקב אחר לוחות הסילוקין שלך</p>
        </div>
        <Button asChild>
          <Link to="/loans/new">
            <PlusCircle className="me-2 h-4 w-4" />
            הלוואה חדשה
          </Link>
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">טוען הלוואות...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-16 text-red-500">
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            נסה שוב
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && loans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-5 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
          <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <CreditCard className="h-8 w-8 text-blue-500" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-300">אין הלוואות עדיין</h2>
            <p className="text-gray-500 dark:text-slate-400 mt-1">הוסף הלוואה כדי לעקוב אחר לוח הסילוקין שלה</p>
          </div>
          <Button asChild>
            <Link to="/loans/new">
              <PlusCircle className="me-2 h-4 w-4" />
              הוסף הלוואה ראשונה
            </Link>
          </Button>
        </div>
      )}

      {/* Loans grid */}
      {!loading && !error && loans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loans.map((loan) => (
            <LoanSummaryCard key={loan._id} loan={loan} />
          ))}
        </div>
      )}
    </div>
  );
}
