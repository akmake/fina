import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import { Mail, X, Loader2 } from 'lucide-react';

/**
 * Non-blocking "verify your email" nag (Phase 4). Shows only when the cached
 * user is explicitly unverified (`emailVerified === false`) — a stale session
 * missing the field won't nag until a refresh/login populates it.
 */
export default function VerifyEmailBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (dismissed || !user || user.emailVerified !== false) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      setSent(true);
    } catch { /* ignore — best effort */ }
    finally { setSending(false); }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2.5 flex items-center gap-3 text-sm" dir="rtl">
      <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-amber-800 dark:text-amber-200 flex-1 min-w-0">
        {sent ? 'שלחנו קישור אימות חדש למייל שלך.' : 'כדאי לאמת את כתובת המייל שלך כדי לאבטח את החשבון.'}
      </p>
      {!sent && (
        <button
          onClick={resend}
          disabled={sending}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          שליחת קישור אימות
        </button>
      )}
      <Link to="/settings" className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline hidden sm:inline">
        להגדרות
      </Link>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-amber-500 hover:text-amber-700" aria-label="סגור">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
