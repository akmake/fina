// client/src/pages/DataEntryPage.jsx

import React, { useState } from "react";
import api from "@/utils/api"; // 1. ייבוא של קובץ ה-API הנכון

export default function DataEntryPage() {
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 2. אין יותר צורך ב-useEffect לקבלת CSRF token, 
  //    קובץ ה-api.js מטפל בזה אוטומטית.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    const numericValue1 = parseFloat(value1);
    const numericValue2 = parseFloat(value2);

    if (isNaN(numericValue1) || isNaN(numericValue2)) {
      setMessage("שגיאה: יש להזין ערכים מספריים בלבד.");
      setIsLoading(false);
      return;
    }

    try {
      // 3. שימוש ב-api.post במקום axios.post
      const response = await api.post("/data/save", {
        value1: numericValue1,
        value2: numericValue2,
      });

      setMessage(response.data.message);
      setValue1("");
      setValue2("");
    } catch (error) {
      const errorMessage = error.response?.data?.message || "אירעה שגיאה בשליחת הנתונים";
      setMessage(`שגיאה: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4">
      <h1 className="text-2xl font-bold mb-4">הזנת נתונים מספריים</h1>
      <p className="mb-4 text-gray-600">הנתונים יישמרו תחת המשתמש שלך.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="value1" className="block text-sm font-medium text-gray-700">
            ערך מספרי 1
          </label>
          <input
            type="number"
            id="value1"
            value={value1}
            onChange={(e) => setValue1(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="value2" className="block text-sm font-medium text-gray-700">
            ערך מספרי 2
          </label>
          <input
            type="number"
            id="value2"
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? "שולח..." : "שמור נתונים"}
        </button>
      </form>

      {message && (
        <p className={`mt-4 text-center font-medium ${message.startsWith('שגיאה') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}