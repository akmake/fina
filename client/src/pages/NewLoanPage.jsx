import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

function NewLoanPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    principal: '',
    interestMargin: '', // שונה מ-annualRate
    termInMonths: '',
    startDate: new Date().toISOString().split('T')[0],
    repaymentType: 'שפיצר',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/loans', {
        ...formData,
        principal: Number(formData.principal),
        interestMargin: Number(formData.interestMargin), // שונה מ-annualRate
        termInMonths: Number(formData.termInMonths),
      });
      toast.success('ההלוואה נוצרה בהצלחה!');
      navigate('/dashboard'); // או לאן שתרצה לנווט אחרי
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'שגיאה ביצירת ההלוואה';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-6 bg-white shadow-md rounded-lg">
      <h1 className="text-2xl font-bold mb-6 text-center">יצירת הלוואה חדשה</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* שדות שם, קרן, תקופה ותאריך נשארים זהים */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">שם ההלוואה</label>
          <input type="text" name="name" id="name" required value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
        <div>
          <label htmlFor="principal" className="block text-sm font-medium text-gray-700">סכום הקרן (₪)</label>
          <input type="number" name="principal" id="principal" required value={formData.principal} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>

        {/* --- שינוי מרכזי כאן --- */}
        <div>
          <label htmlFor="interestMargin" className="block text-sm font-medium text-gray-700">מרווח מריבית הפריים (%)</label>
          <input type="number" step="0.01" name="interestMargin" id="interestMargin" required value={formData.interestMargin} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="לדוגמה: 1.5 עבור פריים + 1.5%" />
        </div>
        {/* --- סוף שינוי --- */}
        
        <div>
          <label htmlFor="termInMonths" className="block text-sm font-medium text-gray-700">תקופה (חודשים)</label>
          <input type="number" name="termInMonths" id="termInMonths" required value={formData.termInMonths} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">תאריך התחלה</label>
          <input type="date" name="startDate" id="startDate" required value={formData.startDate} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
        <div>
          <label htmlFor="repaymentType" className="block text-sm font-medium text-gray-700">שיטת החזר</label>
          <select name="repaymentType" id="repaymentType" value={formData.repaymentType} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            <option value="שפיצר">שפיצר</option>
            <option value="קרן שווה">קרן שווה</option>
            {/* --- תוספת: אופציית בלון --- */}
            <option value="בלון">בלון</option>
          </select>
        </div>
        <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50">
          {isLoading ? 'יוצר הלוואה...' : 'צור הלוואה'}
        </button>
      </form>
    </div>
  );
}

export default NewLoanPage;