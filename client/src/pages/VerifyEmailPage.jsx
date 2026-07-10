import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';

/**
 * Landing page for the email-verification link (/verify-email?token=…).
 * Public route — a user may open it from an email while logged out.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('pending'); // pending | ok | error
  const ran = useRef(false);
  const { user, login } = useAuthStore();

  useEffect(() => {
    if (ran.current) return; // guard StrictMode double-run
    ran.current = true;
    if (!token) { setStatus('error'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => {
        setStatus('ok');
        // Reflect verification in the cached user, if this browser is logged in.
        if (user && !user.emailVerified) login({ ...user, emailVerified: true });
      })
      .catch(() => setStatus('error'));
  }, [token, user, login]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 px-8 py-10 max-w-md w-full text-center">
        {status === 'pending' && (
          <>
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-800">מאמת את כתובת המייל…</h1>
          </>
        )}
        {status === 'ok' && (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">כתובת המייל אומתה! 🎉</h1>
            <p className="text-sm text-slate-500 mt-2">החשבון שלך מאומת ומוכן לשימוש מלא.</p>
            <Link to="/finance-dashboard" className="inline-block mt-6 h-11 leading-[44px] px-6 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-sm font-bold">
              ללוח הבקרה
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">הקישור אינו תקין</h1>
            <p className="text-sm text-slate-500 mt-2">קישור האימות שגוי או שפג תוקפו. ניתן לבקש קישור חדש מההגדרות.</p>
            <Link to="/settings" className="inline-flex items-center gap-2 mt-6 h-11 leading-[44px] px-6 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold">
              <Mail className="h-4 w-4" /> להגדרות החשבון
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
