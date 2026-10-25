/**
 * UpdatesBrief — the dashboard's opening "morning brief".
 *
 * Shows, without the user doing anything: what arrived since their previous
 * visit (as one plain sentence), the live state of every bank connection, the
 * newest transactions and unread alerts. Data: GET /api/dashboard/updates.
 * Polls every 2 min, every 10 s while a sync is running / waiting for its SMS
 * code, and calls `onSynced` when a running sync finishes so the page refreshes.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareText, AlertTriangle, CheckCircle2, PauseCircle, Loader2, Plus, UserPlus, Bell } from 'lucide-react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/stores/authStore';

const FAST_POLL_MS = 10_000;
const SLOW_POLL_MS = 120_000;

const fetchUpdates = () => api.get('/dashboard/updates').then((r) => r.data);

export const timeAgo = (date) => {
  if (!date) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return mins === 1 ? 'לפני דקה' : `לפני ${mins} דקות`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'לפני שעה' : hours === 2 ? 'לפני שעתיים' : `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'אתמול' : days === 2 ? 'לפני יומיים' : `לפני ${days} ימים`;
};

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (h >= 5 && h < 12) return 'בוקר טוב';
  if (h >= 12 && h < 17) return 'צהריים טובים';
  if (h >= 17 && h < 22) return 'ערב טוב';
  return 'לילה טוב';
};

const isBusy = (c) => c.activeJob && ['queued', 'running', 'awaiting_otp'].includes(c.activeJob.status);

// One connection → its live state, in words the user understands.
function connectionState(c) {
  if (c.activeJob?.status === 'awaiting_otp') {
    return { tone: 'waiting', Icon: MessageSquareText, text: 'ממתין לקוד SMS', to: '/connections' };
  }
  if (c.activeJob && ['queued', 'running'].includes(c.activeJob.status)) {
    return { tone: 'busy', Icon: Loader2, text: 'מסנכרן עכשיו', spin: true };
  }
  if (c.status === 'error' || c.status === 'needs_otp' || c.lastSyncStatus === 'error') {
    return { tone: 'error', Icon: AlertTriangle, text: 'דורש טיפול', to: '/connections' };
  }
  if (!c.autoSync || c.status === 'disabled') {
    return { tone: 'idle', Icon: PauseCircle, text: 'מושהה' };
  }
  const added = c.lastInserted > 0 ? ` · ${c.lastInserted} חדשות` : '';
  return { tone: 'ok', Icon: CheckCircle2, text: c.lastSyncAt ? `עודכן ${timeAgo(c.lastSyncAt)}${added}` : 'טרם סונכרן' };
}

const TONE = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200',
  busy: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200',
  waiting: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200',
  idle: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300',
};

const nextSyncLabel = (c) => (c.nextSyncAt && c.autoSync
  ? `הסנכרון הבא: ${new Date(c.nextSyncAt).toLocaleString('he-IL', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}`
  : undefined);

function ConnectionChip({ c }) {
  const s = connectionState(c);
  const body = (
    <>
      <s.Icon className={`h-3.5 w-3.5 shrink-0 ${s.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="font-semibold">{c.displayName || c.company}</span>
      <span className="opacity-80">{s.text}</span>
    </>
  );
  const cls = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${TONE[s.tone]}`;
  return s.to
    ? <Link to={s.to} className={`${cls} hover:brightness-95`} title={nextSyncLabel(c)}>{body}</Link>
    : <span className={cls} title={nextSyncLabel(c)}>{body}</span>;
}

function Headline({ data }) {
  const { count, income, expense } = data.newTransactions;
  const when = data.isFirstVisit ? 'בשבוע האחרון' : `מאז הביקור הקודם, ${timeAgo(data.since)},`;
  if (count === 0) {
    return (
      <p className="text-2xl font-semibold tracking-[-0.03em] leading-snug text-slate-900 dark:text-white sm:text-[2rem]">
        {data.connections.length === 0
          ? 'עוד לא מחובר אף בנק — חבר אחד והעדכונים יגיעו לכאן לבד.'
          : `${when} לא נכנסו עסקאות חדשות.`}
      </p>
    );
  }
  return (
    <p className="text-2xl font-semibold tracking-[-0.03em] leading-snug text-slate-900 dark:text-white sm:text-[2rem]">
      {when} נכנסו {count === 1 ? 'עסקה חדשה אחת' : `${count} עסקאות חדשות`}
      {(expense > 0 || income > 0) && ': '}
      {expense > 0 && <span className="text-red-600 dark:text-red-400 whitespace-nowrap">{formatCurrency(expense)} יצאו</span>}
      {expense > 0 && income > 0 && ' ו־'}
      {income > 0 && <span className="text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatCurrency(income)} נכנסו</span>}
      .
    </p>
  );
}

function BriefSkeleton() {
  return (
    <section className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
      <div className="h-10 w-full max-w-2xl rounded bg-slate-200 dark:bg-white/10" />
      <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-8 w-40 rounded-full bg-slate-200 dark:bg-white/10" />)}</div>
    </section>
  );
}

export default function UpdatesBrief({ onSynced }) {
  const firstName = useAuthStore((s) => s.user?.name?.split(' ')[0]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-updates'],
    queryFn: fetchUpdates,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.connections?.some(isBusy) ? FAST_POLL_MS : SLOW_POLL_MS),
  });

  // When a sync that was running/waiting finishes, refresh the rest of the dashboard.
  const wasBusy = useRef(false);
  useEffect(() => {
    const busy = !!data?.connections?.some(isBusy);
    if (wasBusy.current && !busy) onSynced?.();
    wasBusy.current = busy;
  }, [data, onSynced]);

  if (isLoading) return <BriefSkeleton />;
  if (isError || !data) {
    return (
      <section className="rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
        לא הצלחנו לטעון את העדכונים האחרונים. <button type="button" onClick={() => refetch()} className="font-semibold underline">נסה שוב</button>
      </section>
    );
  }

  const items = data.newTransactions.items || [];
  const alerts = data.alerts.items || [];

  return (
    <section aria-labelledby="brief-title" className="space-y-5">
      <div className="space-y-2">
        <h1 id="brief-title" className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
        <Headline data={data} />
      </div>

      {/* Live connection state */}
      <div className="flex flex-wrap items-center gap-2">
        {data.connections.map((c) => <ConnectionChip key={c._id} c={c} />)}
        <Link
          to="/connections"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/[0.15] dark:text-slate-300"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {data.connections.length === 0 ? 'חיבור בנק או כרטיס' : 'חיבור נוסף'}
        </Link>
      </div>

      {data.pendingApprovals > 0 && (
        <Link
          to="/admin/users"
          className="flex items-center gap-3 rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {data.pendingApprovals === 1 ? 'בקשת הצטרפות אחת ממתינה לאישור שלך' : `${data.pendingApprovals} בקשות הצטרפות ממתינות לאישור שלך`}
          </span>
        </Link>
      )}

      {(items.length > 0 || alerts.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {items.length > 0 && (
            <div className="surface-panel p-0">
              <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">מה נכנס</h2>
                <Link to="/portfolio" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">כל העסקאות</Link>
              </div>
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.05]">
                {items.map((t) => {
                  const isIncome = t.type === 'הכנסה';
                  return (
                    <li key={t._id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">
                        {new Date(t.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.description}</p>
                        <p className="truncate text-xs text-slate-400">{t.category || 'ללא קטגוריה'}</p>
                      </div>
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
                        {isIncome ? '+' : '−'}{formatCurrency(t.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {data.newTransactions.count > items.length && (
                <p className="px-4 pb-3 pt-1 text-xs text-slate-400">ועוד {data.newTransactions.count - items.length}</p>
              )}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="surface-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Bell className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  דורש את תשומת לבך
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">{data.alerts.count}</span>
                </h2>
                <Link to="/alerts" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">כל ההתראות</Link>
              </div>
              <ul className="space-y-2">
                {alerts.slice(0, 4).map((a) => {
                  const content = (
                    <>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.title}</p>
                      {a.message && a.message !== a.title && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{a.message}</p>}
                    </>
                  );
                  const cls = `block rounded-lg border-r-[3px] bg-slate-50 px-3 py-2 dark:bg-white/[0.03] ${
                    a.severity === 'danger' ? 'border-r-red-500' : a.severity === 'warning' ? 'border-r-amber-500' : 'border-r-sky-500'}`;
                  return (
                    <li key={a._id}>
                      {a.actionUrl ? <Link to={a.actionUrl} className={`${cls} hover:bg-slate-100 dark:hover:bg-white/[0.06]`}>{content}</Link> : <div className={cls}>{content}</div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
