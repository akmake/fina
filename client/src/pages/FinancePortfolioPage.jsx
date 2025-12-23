import React, { useState, useEffect } from 'react';
import api from '@/utils/api'; // שימוש בקובץ ה-API המותאם שלך

// רכיבי עזר, ניתן להחליף ברכיבים שלך מ-Shadcn/UI
const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input 
      type="number" 
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
      {...props} 
    />
  </div>
);

const Button = ({ children, ...props }) => (
  <button 
    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
    {...props}
  >
    {children}
  </button>
);


export default function FinancePortfolioPage() {
  const [portfolio, setPortfolio] = useState({
    checking: '',
    cash: '',
    deposits: '',
    stocks: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // טעינת הנתונים הקיימים מהשרת
  useEffect(() => {
    api.get('/finances')
      .then(response => {
        setPortfolio(response.data);
      })
      .catch(err => {
        console.error("Failed to fetch portfolio", err);
        setMessage('שגיאה בטעינת הנתונים');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPortfolio(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const response = await api.post('/finances', portfolio);
      setPortfolio(response.data); // עדכון המצב המקומי עם הנתונים המעודכנים מהשרת
      setMessage('הנתונים נשמרו בהצלחה!');
      setTimeout(() => setMessage(''), 3000); // העלמת ההודעה אחרי 3 שניות
    } catch (error) {
      console.error("Failed to save portfolio", error);
      setMessage('שגיאה בשמירת הנתונים.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center mt-20">טוען נתונים...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-4">
      <h1 className="text-3xl font-bold mb-2">ניהול תיק פיננסי</h1>
      <p className="text-gray-600 mb-6">עדכן את יתרות החשבונות שלך. הנתונים יישמרו אוטומטית תחת המשתמש שלך.</p>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="עובר ושב (עו״ש)"
            name="checking"
            value={portfolio.checking}
            onChange={handleChange}
            placeholder="0"
          />
          <Input 
            label="מזומן"
            name="cash"
            value={portfolio.cash}
            onChange={handleChange}
            placeholder="0"
          />
          <Input 
            label="פקדונות"
            name="deposits"
            value={portfolio.deposits}
            onChange={handleChange}
            placeholder="0"
          />
          <Input 
            label="מניות וקרנות"
            name="stocks"
            value={portfolio.stocks}
            onChange={handleChange}
            placeholder="0"
          />
        </div>
        
        <div className="pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </div>

        {message && (
          <p className={`mt-4 text-center font-medium ${message.startsWith('שגיאה') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}