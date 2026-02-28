import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { UploadCloud, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function DiscountImportPage() {
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        // קריאת הקובץ (raw: false מבטיח שנקבל ערכים קריאים עד כמה שניתן, cellDates עוזר עם תאריכי אקסל)
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        // 1. זיהוי שורת הכותרת בצורה גמישה וחסינה (מתעלם מרווחים)
        let headerRowIndex = -1;
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          
          const rowStr = row.map(cell => String(cell || '')).join(' ');
          if (rowStr.includes('תאריך') && rowStr.includes('תיאור התנועה')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error('לא זוהה פורמט תקין של קובץ עו"ש');
          setLoading(false);
          return;
        }

        const headers = data[headerRowIndex];
        // מציאת האינדקסים בצורה בטוחה
        const dateIdx = headers.findIndex(h => String(h || '').includes('תאריך'));
        const descIdx = headers.findIndex(h => String(h || '').includes('תיאור התנועה'));
        const amountIdx = headers.findIndex(h => String(h || '').includes('זכות/חובה'));

        const parsedIncomes = [];

        // 2. מעבר על נתוני העסקאות
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0 || row[dateIdx] == null) continue;

          // טיפול בסכום
          let rawAmount = row[amountIdx];
          if (typeof rawAmount === 'string') {
              rawAmount = rawAmount.replace(/,/g, '');
          }
          const amount = parseFloat(rawAmount);
          if (isNaN(amount)) continue;

          const desc = String(row[descIdx] || '').trim();
          
          // --- לוגיקת הסינון שלך: רק הכנסות (פלוס) ורק אם התיאור לא מכיל "פיקדון" ---
          if (amount > 0 && !desc.includes('פיקדון')) {
            
            // --- התיקון הקריטי: טיפול חסין בתאריכים ---
            let rawDate = row[dateIdx];
            let formattedDate = '';

            if (rawDate instanceof Date) {
              // אקסל המיר את זה אוטומטית לאובייקט Date
              formattedDate = rawDate.toISOString().split('T')[0];
            } else if (typeof rawDate === 'number') {
              // מספר סידורי של אקסל
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              const jsDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
              formattedDate = jsDate.toISOString().split('T')[0];
            } else {
              // טקסט
              let strDate = String(rawDate).trim();
              if (strDate.includes('/')) {
                const parts = strDate.split('/');
                if (parts.length === 3) {
                  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                  formattedDate = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else {
                  formattedDate = strDate;
                }
              } else if (strDate.includes('-')) {
                const parts = strDate.split('-');
                if (parts[0].length === 4) {
                  formattedDate = strDate; // כבר בפורמט YYYY-MM-DD
                } else if (parts[2] && parts[2].length === 4) {
                  formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // תרגום מ-DD-MM-YYYY
                } else {
                  formattedDate = strDate;
                }
              } else {
                formattedDate = strDate; // ברירת מחדל
              }
            }

            parsedIncomes.push({
              date: formattedDate,
              description: desc,
              amount: amount,
              type: 'הכנסה',
              category: 'כללי', 
              account: 'עו"ש'
            });
          }
        }

        if (parsedIncomes.length === 0) {
          toast('לא נמצאו הכנסות חדשות (או שכל ההכנסות היו קשורות לפיקדון)', { icon: 'ℹ️' });
        } else {
          toast.success(`נמצאו ${parsedIncomes.length} הכנסות אמיתיות!`);
        }

        setIncomes(parsedIncomes);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('שגיאה בפענוח הקובץ');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const income of incomes) {
      try {
        await api.post('/transactions', income);
        successCount++;
      } catch (error) {
        if (error.response && error.response.status === 409) {
          // כבר קיים, נתעלם
        } else {
          errorCount++;
        }
      }
    }

    setSaving(false);
    toast.success(`${successCount} הכנסות נשמרו בהצלחה למערכת!`);
    if (errorCount > 0) {
      toast.error(`היו ${errorCount} שגיאות בשמירה.`);
    }
    
    setIncomes([]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
            <UploadCloud className="h-7 w-7" />
            ייבוא הכנסות בנק דיסקונט
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            מעלים את קובץ האקסל/CSV - והמערכת תשלוף רק את ההכנסות האמיתיות.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 relative">
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls" 
            onChange={handleFileUpload}
            disabled={loading || saving}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud className={`h-12 w-12 text-emerald-400 mb-3 ${loading ? 'animate-bounce' : ''}`} />
          <h3 className="text-lg font-medium text-gray-900">
            {loading ? 'מפענח את הקובץ...' : 'לחצו כאן או גררו את קובץ הדיסקונט לכאן'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">תומך ב-XLSX, CSV</p>
        </CardContent>
      </Card>

      {incomes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              תצוגה מקדימה: נמצאו {incomes.length} הכנסות נטו
            </CardTitle>
            <Button onClick={handleSaveAll} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 me-2" />
              {saving ? 'שומר...' : 'שמור הכל למערכת'}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">תאריך</th>
                    <th className="px-4 py-2 font-medium">תיאור העסקה (מקור)</th>
                    <th className="px-4 py-2 font-medium">סכום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {incomes.map((income, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{income.date}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{income.description}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">
                        +{formatCurrency(income.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {incomes.length === 0 && !loading && (
        <div className="text-center p-6 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center gap-2">
          <AlertCircle className="h-5 w-5" />
          עדיין לא הועלו נתונים או שלא נמצאו הכנסות בקובץ.
        </div>
      )}
    </div>
  );
}