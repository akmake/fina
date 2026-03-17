import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';
import './index.css';
import { warmCsrf } from './utils/api.js';

// מחמם את ה-CSRF token מיד עם טעינת האפליקציה — לפני שהקומפוננטים
// מתחילים לשלוח בקשות, כדי לחסוך עיכוב של round-trip שלם בהפעלה הראשונה
warmCsrf();
// Toaster is provided by Layout.jsx to keep it co-located with the app shell.  

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <HelmetProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </BrowserRouter>
      </HelmetProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
