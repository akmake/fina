import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Bot, Copy, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * AI assistant access (MCP): create / revoke the personal READ-ONLY key the
 * Fina MCP server (/mcp in the repo) uses. The key is shown exactly once, with
 * ready-to-paste setup for Claude Desktop and Claude Code. Talks to /api/ai-keys.
 */

// Absolute API URL for the MCP config (the client may use a relative /api in dev).
const apiUrl = () => {
  const base = api.defaults.baseURL || '/api';
  return /^https?:\/\//.test(base) ? base.replace(/\/+$/, '') : `${window.location.origin}${base.startsWith('/') ? '' : '/'}${base}`.replace(/\/+$/, '');
};

const fmt = (d) => (d ? new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : 'עוד לא');

function CopyBlock({ label, text }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success('הועתק'); } catch { /* user can select manually */ }
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <Button type="button" size="sm" variant="ghost" onClick={copy} aria-label={`העתק: ${label}`}><Copy className="h-3.5 w-3.5" /></Button>
      </div>
      <pre dir="ltr" className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-slate-50 p-3 text-left text-[11px] leading-5 text-slate-800 dark:bg-black/30 dark:text-slate-100">{text}</pre>
    </div>
  );
}

export default function AiAccessSection() {
  const [keys, setKeys] = useState(null); // null = loading
  const [name, setName] = useState('Claude');
  const [allowCategorize, setAllowCategorize] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/ai-keys').then(({ data }) => setKeys(data)).catch(() => setKeys([]));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/ai-keys', { name, allowCategorize });
      setToken(data.token);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'שגיאה ביצירת המפתח');
    } finally { setBusy(false); }
  };

  const revoke = async (k) => {
    if (!confirm(`לבטל את המפתח "${k.name}"? עוזר שמשתמש בו יפסיק לקבל נתונים מיד.`)) return;
    try {
      await api.delete(`/ai-keys/${k._id}`);
      toast.success('המפתח בוטל');
      await load();
    } catch (e) { toast.error(e?.response?.data?.message || 'שגיאה בביטול'); }
  };

  const url = apiUrl();
  const desktopConfig = JSON.stringify({
    mcpServers: {
      fina: {
        command: 'node',
        args: ['C:/path/to/fina/mcp/index.js'],
        env: { FINA_API_URL: url, FINA_API_KEY: token },
      },
    },
  }, null, 2);
  const codeCommand = `claude mcp add fina -e FINA_API_URL=${url} -e FINA_API_KEY=${token} -- node C:/path/to/fina/mcp/index.js`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> חיבור לעוזר AI</CardTitle>
        <CardDescription>
          מאפשר לעוזר כמו Claude לענות על שאלות על הכסף שלך ("כמה הוצאנו על מסעדות החודש?").
          כברירת מחדל המפתח <strong>לקריאה בלבד</strong>. אפשר להרשות לו גם לשנות שמות של בתי עסק וקטגוריות — שום דבר אחר (לא מחיקות, לא העברות, לא הגדרות). הנתונים שהעוזר שולף עוברים לספק ה-AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {token ? (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10" role="status">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              המפתח מוצג פעם אחת בלבד. העתק אותו עכשיו להגדרות העוזר:
            </p>
            <CopyBlock label="המפתח" text={token} />
            <CopyBlock label="Claude Code — פקודה אחת בטרמינל" text={codeCommand} />
            <CopyBlock label="Claude Desktop — להוסיף ל-claude_desktop_config.json" text={desktopConfig} />
            <Button type="button" variant="outline" size="sm" onClick={() => setToken('')}>סיימתי</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="ai-key-name" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">שם המפתח</label>
              <Input id="ai-key-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </div>
            <label className="flex w-full cursor-pointer select-none items-start gap-2 rounded-md border border-slate-200 p-3 text-sm dark:border-white/[0.08]">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={allowCategorize} onChange={(e) => setAllowCategorize(e.target.checked)} />
              <span>
                <span className="font-medium text-slate-700 dark:text-slate-200">לאפשר לעוזר לשנות שמות של בתי עסק וקטגוריות</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">השינוי חל על כל העסקאות של אותו בית עסק ונלמד לייבואים הבאים. כל שינוי נרשם ביומן.</span>
              </span>
            </label>
            <Button type="button" onClick={create} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'יצירת מפתח'}
            </Button>
          </div>
        )}

        {keys === null ? (
          <p className="text-sm text-slate-400">טוען…</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">אין מפתחות פעילים.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {keys.map((k) => (
              <li key={k._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{k.name}</span>
                  <span className="mr-2 text-xs text-slate-400" dir="ltr">{k.tokenHint}…</span>
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${(k.scopes || []).includes('categorize') ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}>
                    {(k.scopes || []).includes('categorize') ? 'קריאה + שינוי שמות וקטגוריות' : 'קריאה בלבד'}
                  </span>
                  <p className="text-xs text-slate-400">נוצר {fmt(k.createdAt)} · שימוש אחרון: {fmt(k.lastUsedAt)}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => revoke(k)} aria-label={`בטל את ${k.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
