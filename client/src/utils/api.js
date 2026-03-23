import axios from 'axios';

// משתנה להחזקת הפונקציות מה-Store כדי למנוע תלות מעגלית
let authStoreApi = {
  login: () => console.warn('Auth store not initialized yet (login).'),
  logout: () => console.warn('Auth store not initialized yet (logout).'),
};

/**
 * פונקציה להזרקת ה-Store לתוך ה-API
 */
export function injectAuthStore(store) {
  authStoreApi = store;
}

// --- הגדרת כתובות עם משתני סביבה (env variables) ---
// VITE_API_URL צריך להיות מוגדר ב-.env או .env.production
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';


// יצירת מופע Axios
const api = axios.create({
  baseURL: BASE_URL, 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Fina-Client': 'web-app',
  },
});

// ── Client-side analytics headers (screen, hardware, connection) ──
// Generate a simple session ID for grouping requests
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getAnalyticsHeaders = () => {
  const headers = {};
  try {
    // Screen info
    if (window.screen) {
      headers['X-Screen-Width'] = String(window.screen.width);
      headers['X-Screen-Height'] = String(window.screen.height);
      headers['X-Color-Depth'] = String(window.screen.colorDepth || '');
    }
    // Hardware
    if (navigator.hardwareConcurrency) headers['X-HW-Cores'] = String(navigator.hardwareConcurrency);
    if (navigator.deviceMemory) headers['X-HW-Memory'] = String(navigator.deviceMemory);
    // Connection
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      if (conn.effectiveType) headers['X-Connection-Type'] = conn.effectiveType;
      if (conn.downlink) headers['X-Connection-Downlink'] = String(conn.downlink);
      if (conn.rtt) headers['X-Connection-RTT'] = String(conn.rtt);
    }
    // Session
    headers['X-Session-Id'] = sessionId;
  } catch (_) { /* silent fail */ }
  return headers;
};

let csrfTokenPromise = null;

// פונקציה להשגת טוקן CSRF (מונעת קריאות כפולות)
const getCsrfToken = (forceRefresh = false) => {
  if (!csrfTokenPromise || forceRefresh) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(response => {
        const csrfToken = response.data.csrfToken;
        api.defaults.headers.common['X-CSRF-Token'] = csrfToken;
        return csrfToken;
      })
      .catch(error => {
        console.error('Failed to fetch CSRF token', error);
        csrfTokenPromise = null;
        return Promise.reject(error);
      });
  }
  return csrfTokenPromise;
};

// Interceptor לבקשות - וידוא שיש CSRF
api.interceptors.request.use(async (config) => {
  // הוספת headers אנליטיקס לכל בקשה
  const analyticsHeaders = getAnalyticsHeaders();
  Object.assign(config.headers, analyticsHeaders);

  // דילוג אם הבקשה היא לקבלת הטוקן עצמו
  if (config.url === '/csrf-token') {
    return config;
  }

  // אם אין טוקן בהדרים, ננסה להשיג אותו
  if (!api.defaults.headers.common['X-CSRF-Token']) {
    try {
      await getCsrfToken();
    } catch (err) {
      // אם נכשלנו להשיג טוקן, נמשיך — השרת יחזיר שגיאה מתאימה
    }
  }
  return config;
}, (error) => Promise.reject(error));

// משתנים לניהול חידוש טוקן (Refresh Token)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor לתשובות - טיפול בשגיאות 401 וחידוש טוקן
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // --- טיפול ב-CSRF 403: חידוש טוקן CSRF ושליחה מחדש ---
    if (error.response?.status === 403 && !originalRequest._csrfRetry) {
      const msg = error.response?.data?.message || '';
      if (msg.includes('CSRF')) {
        originalRequest._csrfRetry = true;
        try {
          await getCsrfToken(true); // force refresh
          return api(originalRequest);
        } catch (csrfErr) {
          return Promise.reject(csrfErr);
        }
      }
    }

    // --- טיפול ב-401: חידוש access token ---
    // מניעת לולאה: אם בקשת ה-refresh עצמה נכשלת ב-401, לא ננסה לרענן שוב
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      
      // אם אנחנו כבר באמצע תהליך חידוש, הכנס לתור
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // בקשת חידוש טוקן
        const { data } = await api.post('/auth/refresh');
        
        // עדכון ה-Store בהצלחה
        if (data && data.user) {
          authStoreApi.login(data.user);
        }

        // שחרור התור
        processQueue(null);
        
        // שליחה מחדש של הבקשה המקורית
        return api(originalRequest);
      } catch (refreshError) {
        // במקרה של כישלון בחידוש (למשל הטוקן פג תוקף לגמרי)
        processQueue(refreshError, null);
        authStoreApi.logout(); // ניתוק המשתמש
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * קריאה מוקדמת ל-CSRF token — לקרוא בהפעלת האפליקציה
 * כדי שה-token יהיה מוכן לפני שהקומפוננטים מתחילים לשלוח בקשות
 */
export const warmCsrf = () => getCsrfToken();

export default api;