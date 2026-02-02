import { google } from 'googleapis';
import path from 'path';

const { GOOGLE_SERVICE_ACCOUNT, GOOGLE_SHEET_ID } = process.env;

let sheets = null;

// ניסיון לאתחל רק אם יש את המשתנה הנדרש
if (GOOGLE_SERVICE_ACCOUNT) {
  if (!GOOGLE_SHEET_ID) {
    console.warn('מזהה: GOOGLE_SHEET_ID חסר, אך קיים Service Account.');
  } else {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(GOOGLE_SERVICE_ACCOUNT),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      sheets = google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error('שגיאה באתחול Google Sheets:', error.message);
    }
  }
} else {
  console.warn('מזהה: GOOGLE_SERVICE_ACCOUNT חסר. תמיכה ב-Google Sheets מנוטרלת.');
}

/* ───────── public helper ───────── */
export async function appendOrder(row, tab) {
  // הגנה: אם אין חיבור, אל תעשה כלום ואל תזרוק שגיאה
  if (!sheets) {
    return;
  }

  await ensureSheet(tab);

  /* ה-range חייב להיות עם גרשיים אם השם כולל תווים לא-לטיניים / רווחים */
  const range = `'${tab}'!A1`;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  } catch (err) {
    console.error(`Failed to append to sheet "${tab}":`, err.message);
  }
}

/* ───────── create sheet if missing ───────── */
async function ensureSheet(title) {
  if (!sheets) return;

  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      fields: 'sheets.properties.title',
    });

    const exists = meta.data.sheets.some(
      (s) => s.properties.title === title
    );
    if (exists) return;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  } catch (err) {
    console.error(`Failed to ensure sheet "${title}":`, err.message);
  }
}