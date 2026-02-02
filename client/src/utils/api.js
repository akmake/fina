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

// --- הגדרת כתובות (התיקון לבעיית התקשורת) ---
const DEV_URL = 'http://localhost:5000/api'; // כתובת לפיתוח מקומי
const PROD_URL = 'https://english-t9tj.onrender.com/api'; // כתובת השרת ברנדר

// בדיקה: אם אנחנו ב-Production (רנדר), נשתמש בכתובת השרת. אחרת ב-Localhost.
const BASE_URL = import.meta.env.MODE === 'production' ? PROD_URL : DEV_URL;

console.log('API Base URL:', BASE_URL); // לוג כדי שתוכל לראות בקונסול לאן הוא פונה

// יצירת מופע Axios
const api = axios.create({
  baseURL: BASE_URL, 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let csrfTokenPromise = null;

// פונקציה להשגת טוקן CSRF (מונעת קריאות כפולות)
const getCsrfToken = () => {
  if (!csrfTokenPromise) {
    // בגלל ש-baseURL מוגדר, זה יפנה לכתובת הנכונה (למשל: https://english-t9tj.../api/csrf-token)
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
  // דילוג אם הבקשה היא לקבלת הטוקן עצמו
  if (config.url === '/csrf-token') {
    return config;
  }
  
  // אם אין טוקן בהדרים, ננסה להשיג אותו
  if (!api.defaults.headers.common['X-CSRF-Token']) {
    try {
      await getCsrfToken();
    } catch (err) {
      // אם נכשלנו להשיג טוקן, ייתכן שהשרת למטה או בעיית רשת.
      // נמשיך בכל זאת כדי שהשרת יחזיר שגיאה מתאימה.
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

    // אם קיבלנו 401 וזו לא בקשה שכבר ניסינו לחדש
    if (error.response?.status === 401 && !originalRequest._retry) {
      
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

export default api;