/**
 * Minimal HTTP client for Fina's read-only AI API (/api/ai/*).
 * Kept separate from index.js so it can be unit-tested without a transport.
 */

const TIMEOUT_MS = 20_000;

const ERRORS = {
  401: 'מפתח ה-AI לא תקין או שבוטל — צור מפתח חדש ב-Fina (הגדרות → חיבור לעוזר AI) ועדכן את FINA_API_KEY',
  405: 'המפתח הזה לקריאה בלבד — כדי לשנות שמות וקטגוריות צור ב-Fina מפתח עם ההרשאה "שינוי שמות וקטגוריות"',
  429: 'יותר מדי בקשות ל-Fina — נסה שוב בעוד כמה דקות',
};

export const createFinaClient = ({ baseUrl, apiKey, fetchImpl = globalThis.fetch } = {}) => {
  const base = (baseUrl || '').replace(/\/+$/, '');
  const configured = Boolean(base && apiKey);

  const request = async (method, path, { params = {}, body } = {}) => {
    if (!configured) throw new Error('חסרים FINA_API_URL ו-FINA_API_KEY בהגדרות שרת ה-MCP');
    if (!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(base)) {
      throw new Error('FINA_API_URL חייב להיות https:// (או localhost לפיתוח)');
    }

    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          // Fina's CSRF guard requires this header on every write.
          ...(body !== undefined && { 'Content-Type': 'application/json', 'X-Fina-Client': 'web-app' }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(`לא ניתן להתחבר ל-Fina (${base}): ${err.message}`);
    }

    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(ERRORS[res.status] || payload?.message || `שגיאה מ-Fina (HTTP ${res.status})`);
    return payload;
  };

  return {
    configured,
    get: (path, params) => request('GET', path, { params }),
    post: (path, body) => request('POST', path, { body: body ?? {} }),
  };
};
