import React, { useState } from 'react';
import api from '@/utils/api'; // שימוש בקובץ ה-API המוגדר שלך

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('שגיאה: נא לבחור קובץ.');
      return;
    }

    setUploading(true);
    setMessage('מעלה ומעבד את הקובץ, התהליך עשוי לקחת מספר דקות...');

    const formData = new FormData();
    // השם 'databaseFile' חייב להתאים לשם שהגדרנו בשרת
    formData.append('databaseFile', selectedFile);

    try {
      const response = await api.post('/import/sqlite', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage(response.data.message);
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'אירעה שגיאה לא צפויה.';
      setMessage(`שגיאה: ${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">ייבוא חד-פעמי מ-SQLite</h1>
      <p className="text-gray-600 mb-6">
        פעולה זו מיועדת להעברה חד-פעמית של הנתונים מהתוכנה הישנה. בחר את קובץ מסד הנתונים (`.db`). 
        <strong className="text-red-600">שים לב:</strong> כל העסקאות הקיימות שלך יימחקו ויוחלפו בנתונים מהקובץ.
      </p>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input 
          type="file" 
          onChange={handleFileChange} 
          accept=".db"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {selectedFile && <p className="mt-4 text-sm text-gray-500">קובץ שנבחר: {selectedFile.name}</p>}
      </div>

      <div className="mt-6">
        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {uploading ? 'מייבא...' : 'התחל ייבוא'}
        </button>
      </div>

      {message && (
        <p className={`mt-4 text-center font-medium ${message.startsWith('שגיאה') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}