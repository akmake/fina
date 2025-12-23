// client/src/utils/api.js

import axios from 'axios';

// We create a variable to hold the store's functions.
// This avoids a direct import cycle.
let authStoreApi = {
  login: () => console.error('Auth store not initialized for API utility.'),
  logout: () => console.error('Auth store not initialized for API utility.'),
};

/**
 * This function allows the authStore to "inject" its functions into this module.
 * It will be called from authStore.js to break the circular dependency.
 * @param {object} store - The auth store's state and actions.
 */
export function injectAuthStore(store) {
  authStoreApi = store;
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let csrfTokenPromise = null;

const getCsrfToken = () => {
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(response => {
        const csrfToken = response.data.csrfToken;
        api.defaults.headers.common['X-CSRF-Token'] = csrfToken;
        return csrfToken;
      })
      .catch(error => {
        console.error('Could not get CSRF token', error);
        csrfTokenPromise = null;
        return Promise.reject(error);
      });
  }
  return csrfTokenPromise;
};

api.interceptors.request.use(async (config) => {
  if (config.url === '/csrf-token') {
    return config;
  }
  if (!api.defaults.headers.common['X-CSRF-Token']) {
    await getCsrfToken();
  }
  return config;
}, (error) => Promise.reject(error));

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        // Now we use the injected store functions directly
        authStoreApi.login(data.user);
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        authStoreApi.logout();
        // Redirecting from here can be problematic. The UI should handle redirects
        // based on the authentication state.
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;