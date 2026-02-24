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

export { cleanCalFile, cleanMaxFile };