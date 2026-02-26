// server/utils/excelCleaners.js

function findTableData(data, keyHeaders) {
  const headerRowIndex = data.findIndex(row =>
    Array.isArray(row) && keyHeaders.every(header =>
      row.some(cell => typeof cell === 'string' && cell.trim().includes(header))
    )
  );

  if (headerRowIndex === -1) {
    throw new Error(`לא הצלחנו לזהות את שורת הכותרות. ודא שהקובץ מכיל עמודות: ${keyHeaders.join(', ')}.`);
  }

  const headers = data[headerRowIndex].map(h => String(h || '').trim().replace(/\s+/g, ' '));
  const rowsAfterHeaders = data.slice(headerRowIndex + 1);

  const dataRows = rowsAfterHeaders.filter(row => 
    Array.isArray(row) && row.filter(cell => cell != null && String(cell).trim() !== '').length >= 2
  );

  return { headers, dataRows };
}

const cleanMaxFile = (data) => {
  // מחפש את הכותרות המדויקות שמופיעות בקובץ ששלחת
  const { headers, dataRows } = findTableData(data, ['תאריך עסקה', 'שם בית העסק', 'סכום חיוב']);

  if (dataRows.length < 1) {
    throw new Error("לא נמצאו נתונים בקובץ 'מקס' לאחר הניקוי.");
  }

  return dataRows.map(rowArray => {
    let rowObject = {};
    headers.forEach((header, index) => {
      if (header) {
        rowObject[header] = rowArray[index];
      }
    });
    return rowObject;
  });
};

const cleanCalFile = (data) => {
    const headerRowIndex = data.findIndex(row =>
        Array.isArray(row) &&
        row.some(cell => typeof cell === 'string' && cell.includes('תאריך')) &&
        row.some(cell => typeof cell === 'string' && cell.includes('שם בית עסק'))
    );
    
    if (headerRowIndex === -1) {
        throw new Error("קובץ 'כאל' לא תקין: לא הצלחנו לזהות את שורת הכותרות.");
    }

    const dataRows = data.slice(headerRowIndex + 1);
    const finalRows = dataRows.filter(row => 
        Array.isArray(row) && row[0] && row[1]
    );

    if (finalRows.length < 1) {
        throw new Error("לא נמצאו שורות נתונים תקינות בקובץ 'כאל'.");
    }

    return finalRows.map(rowArray => {
        return {
            "תאריך עסקה": rowArray[0],
            "שם בית העסק": rowArray[1],
            "סכום חיוב": rowArray[2]
        };
    });
};

const cleanIsracardFile = (data) => {
  const results = [];
  let dateIdx = -1;
  let merchantIdx = -1;
  let amountIdx = -1;
  let parsingTable = false;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;

    // זיהוי שורת כותרת (ישראכרט לעיתים מחלקת למספר טבלאות שונות באותו קובץ)
    const isHeaderRow = row.some(cell => typeof cell === 'string' && cell.includes('תאריך רכישה')) &&
                        row.some(cell => typeof cell === 'string' && cell.includes('שם בית עסק'));

    if (isHeaderRow) {
      const headers = row.map(h => String(h || '').trim());
      dateIdx = headers.findIndex(h => h.includes('תאריך רכישה'));
      merchantIdx = headers.findIndex(h => h.includes('שם בית עסק'));
      amountIdx = headers.findIndex(h => h.includes('סכום חיוב'));
      parsingTable = true;
      continue; // מדלגים על שורת הכותרת עצמה ועוברים לשורות המידע
    }

    if (parsingTable) {
      // מוודאים שמצאנו את כל העמודות הנדרשות
      if (dateIdx === -1 || merchantIdx === -1 || amountIdx === -1) continue;

      const dateVal = row[dateIdx];
      const merchantVal = String(row[merchantIdx] || '').trim();
      const amountVal = row[amountIdx];

      const isDateLike = dateVal instanceof Date ||
        (typeof dateVal === 'string' && /\d{1,2}[./-]\d{1,2}/.test(dateVal));

      // דילוג על שורות שאינן עסקאות (כמו שורות ריקות, כותרות ביניים או "סה"כ")
      if (!isDateLike || !merchantVal || merchantVal.includes('סה"כ')) {
        continue;
      }

      results.push({
        "תאריך רכישה": dateVal,
        "שם בית עסק": merchantVal,
        "סכום חיוב": amountVal,
      });
    }
  }

  if (results.length === 0) {
    throw new Error("לא נמצאו עסקאות בקובץ 'ישראכרט'. ודא שהקובץ מכיל עמודות: תאריך רכישה, שם בית עסק, סכום חיוב.");
  }

  return results;
};

export { cleanCalFile, cleanMaxFile, cleanIsracardFile };