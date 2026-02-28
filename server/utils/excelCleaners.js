// server/utils/excelCleaners.js

const cleanMaxFile = (data) => {
  const results = [];
  
  // מוודא שאנחנו עובדים עם מערך של גיליונות. אם זה לא, הופך את זה לאחד.
  const sheets = (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) 
                 ? data 
                 : [{ sheetName: 'Sheet1', rows: Array.isArray(data) ? data : [] }];

  sheets.forEach(sheet => {
    let currentHeaders = null;
    const rows = sheet.rows || [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // חייב להיות מערך עם נתונים
      if (!Array.isArray(row) || row.length === 0) continue;

      // זיהוי שורת כותרת בגיליון הנוכחי (תופס גם ארץ וגם חו"ל)
      const isHeaderRow = row.some(cell => typeof cell === 'string' && cell.includes('תאריך')) &&
                          row.some(cell => typeof cell === 'string' && cell.includes('בית'));

      if (isHeaderRow) {
        currentHeaders = row.map(h => h ? String(h).trim() : '');
        continue; // מדלגים על שורת הכותרת עצמה
      }

      if (currentHeaders) {
        // מזהים איפה העמודות הקריטיות יושבות כדי לסנן שורות ריקות או סיכומים למטה
        const dateIndex = currentHeaders.findIndex(h => h.includes('תאריך'));
        const amountIndex = currentHeaders.findIndex(h => h.includes('חיוב') || h.includes('סכום'));
        
        const hasDate = dateIndex !== -1 && row[dateIndex] != null && String(row[dateIndex]).trim() !== '';
        const hasAmount = amountIndex !== -1 && row[amountIndex] != null && String(row[amountIndex]).trim() !== '';

        // אם זו שורת עסקה אמיתית, בונים ממנה אובייקט
        if (hasDate && hasAmount) {
          let rowObject = {};
          currentHeaders.forEach((header, index) => {
            if (header) {
              rowObject[header] = row[index];
            }
          });
          results.push(rowObject);
        }
      }
    }
  });

  if (results.length === 0) {
    throw new Error("לא נמצאו נתונים תקינים בקובץ 'מקס'. ודא שהקובץ תקין.");
  }

  return results;
};

const cleanCalFile = (data) => {
    // שוטח גיליונות למערך אחד במידה והגיעו בפורמט של טאבים
    let rows = [];
    if (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) {
        data.forEach(s => rows.push(...(s.rows || [])));
    } else {
        rows = Array.isArray(data) ? data : [];
    }

    const headerRowIndex = rows.findIndex(row =>
        Array.isArray(row) &&
        row.some(cell => typeof cell === 'string' && cell.includes('תאריך')) &&
        row.some(cell => typeof cell === 'string' && cell.includes('שם בית עסק'))
    );
    
    if (headerRowIndex === -1) {
        throw new Error("קובץ 'כאל' לא תקין: לא הצלחנו לזהות את שורת הכותרות.");
    }

    const dataRows = rows.slice(headerRowIndex + 1);
    const finalRows = dataRows.filter(row => 
        Array.isArray(row) && row[0] && row[1]
    );

    if (finalRows.length < 1) {
        throw new Error("לא נמצאו שורות נתונים תקינות בקובץ 'כאל'.");
    }

    return finalRows.map(rowArray => ({
        "תאריך עסקה": rowArray[0],
        "שם בית העסק": rowArray[1],
        "סכום חיוב": rowArray[2]
    }));
};

const cleanIsracardFile = (data) => {
  const results = [];
  
  let rows = [];
  if (Array.isArray(data) && data[0] && Array.isArray(data[0].rows)) {
      data.forEach(s => rows.push(...(s.rows || [])));
  } else {
      rows = Array.isArray(data) ? data : [];
  }

  let dateIdx = -1;
  let merchantIdx = -1;
  let amountIdx = -1;
  let parsingTable = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const isHeaderRow = row.some(cell => typeof cell === 'string' && cell.includes('תאריך רכישה')) &&
                        row.some(cell => typeof cell === 'string' && cell.includes('שם בית עסק'));

    if (isHeaderRow) {
      const headers = row.map(h => String(h || '').trim());
      dateIdx = headers.findIndex(h => h.includes('תאריך רכישה'));
      merchantIdx = headers.findIndex(h => h.includes('שם בית עסק'));
      amountIdx = headers.findIndex(h => h.includes('סכום חיוב'));
      parsingTable = true;
      continue;
    }

    if (parsingTable) {
      if (dateIdx === -1 || merchantIdx === -1 || amountIdx === -1) continue;

      const dateVal = row[dateIdx];
      const merchantVal = String(row[merchantIdx] || '').trim();
      const amountVal = row[amountIdx];

      const isDateLike = dateVal instanceof Date ||
        (typeof dateVal === 'string' && /\d{1,2}[./-]\d{1,2}/.test(dateVal));

      if (!isDateLike || !merchantVal || merchantVal.includes('סה"כ')) continue;

      results.push({
        "תאריך רכישה": dateVal,
        "שם בית עסק": merchantVal,
        "סכום חיוב": amountVal,
      });
    }
  }

  if (results.length === 0) {
    throw new Error("לא נמצאו עסקאות בקובץ 'ישראכרט'.");
  }

  return results;
};

export { cleanCalFile, cleanMaxFile, cleanIsracardFile };