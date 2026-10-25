import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import { AlertCircle, Bot, Check, Loader2, X } from 'lucide-react';

/**
 * OAuth consent — an AI assistant (ChatGPT / Claude.ai connector) asks to read
 * the user's Fina data through the remote MCP. Reached via /api/oauth/authorize,
 * which forwards the original request here; approving returns the browser to the
 * assistant with a one-time code. Contract: docs/modules/ai-mcp.md § OAuth.
 */
export default function OAuthConsentPage() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [allowCategorize, setAllowCategorize] = useState(false);
  const [busy, setBusy] = useState(''); // '' | 'approve' | 'deny'

  const params = Object.fromEntries(new URLSearchParams(search));

  useEffect(() => {
    api.get('/oauth/consent', { params })
      .then(({ data }) => setInfo(data))
      .catch((e) => {
        if (e?.response?.status === 401) navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
        else setError(e?.response?.data?.message || 'לא ניתן לטעון את בקשת החיבור. נסו שוב.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const decide = async (approve) => {
    setBusy(approve ? 'approve' : 'deny');
    setError('');
    try {
      const { data } = await api.post('/oauth/consent', { params, approve, allowCategorize: approve && allowCategorize });
      window.location.assign(data.redirectTo);
    } catch (e) {
      setError(e?.response?.data?.message || 'הפעולה נכשלה. נסו שוב.');
      setBusy('');
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-white/[0.08] dark:bg-slate-900 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient shadow-lg shadow-blue-600/30">
            <Bot className="h-6 w-6 text-white" />
          </div>
          {info ? (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                <span dir="auto">{info.clientName}</span> מבקש גישה ל-Fina
              </h1>
              {user?.email && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">מחובר/ת בתור <span dir="ltr">{user.email}</span></p>}
            </>
          ) : (
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">חיבור עוזר AI</h1>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {!info && !error && (
          <div className="flex justify-center py-8" role="status" aria-label="טוען"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        )}

        {info && (
          <>
            <ul className="mb-5 space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                לקרוא עסקאות, סיכומי הוצאות והכנסות, תקציבים, מצב חיבורי הבנק והתראות
              </li>
              <li className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                לא יכול להעביר כסף, למחוק נתונים, לראות סיסמאות או לשנות הגדרות
              </li>
            </ul>

            <label className="mb-5 flex cursor-pointer select-none items-start gap-2.5 rounded-2xl border border-slate-200 p-3 text-sm dark:border-white/[0.08]">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={allowCategorize} onChange={(e) => setAllowCategorize(e.target.checked)} />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-100">לאפשר גם לשנות שמות של בתי עסק וקטגוריות</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {info.requestsCategorize ? 'העוזר ביקש את ההרשאה הזו. ' : ''}השינוי חל על כל העסקאות של בית העסק ונרשם ביומן. אפשר להשאיר כבוי.
                </span>
              </span>
            </label>

            <p className="mb-6 text-xs leading-5 text-slate-500 dark:text-slate-400">
              מה שהעוזר קורא נשלח לספק ה-AI שלו. אחרי האישור תחזור/י אל <span dir="ltr" className="font-medium">{info.redirectHost}</span>.
              אפשר לנתק בכל רגע בהגדרות ← חיבור לעוזר AI.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => decide(false)}
                disabled={!!busy}
                className="h-11 flex-1 rounded-full border border-slate-200 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                {busy === 'deny' ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'ביטול'}
              </button>
              <button
                type="button"
                onClick={() => decide(true)}
                disabled={!!busy}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 active:translate-y-px disabled:opacity-60"
              >
                {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'אישור וחיבור'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
