import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import { useConnectionsStore } from '@/stores/connectionsStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import {
  Plus, RefreshCw, Trash2, Loader2, ShieldCheck, AlertTriangle,
  CheckCircle, Clock, Building2, Smartphone,
} from 'lucide-react';

// visaCal uses a per-session browser OTP token that can't be reused for
// unattended sync — it stays on the one-time /import/auto page.
const UNSUPPORTED = new Set(['visaCal']);

const STATUS_BADGE = {
  active:    { label: 'פעיל',            cls: 'bg-green-50 text-green-700 border-green-200',  Icon: ShieldCheck },
  error:     { label: 'שגיאה',           cls: 'bg-red-50 text-red-700 border-red-200',        Icon: AlertTriangle },
  disabled:  { label: 'מושהה',           cls: 'bg-slate-100 text-slate-500 border-slate-200', Icon: Clock },
  needs_otp: { label: 'דרוש אימות מחדש', cls: 'bg-amber-50 text-amber-700 border-amber-200',  Icon: Smartphone },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : 'טרם סונכרן');

function StatusBadge({ status }) {
  const b = STATUS_BADGE[status] || STATUS_BADGE.active;
  const { Icon } = b;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${b.cls}`}>
      <Icon className="h-3 w-3" />{b.label}
    </span>
  );
}

export default function BankConnectionsPage() {
  const {
    connections, companies, loading, syncing,
    fetchConnections, fetchCompanies, createConnection, deleteConnection, updateConnection, syncConnection,
  } = useConnectionsStore();

  const [showAdd, setShowAdd] = useState(false);
  const [company, setCompany] = useState('');
  const [fields, setFields] = useState({});
  const [displayName, setDisplayName] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [incomesOnly, setIncomesOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  // One Zero OTP sub-flow
  const [ozStep, setOzStep] = useState('form'); // 'form' | 'otp'
  const [ozContext, setOzContext] = useState('');
  const [ozCode, setOzCode] = useState('');
  const [ozBusy, setOzBusy] = useState(false);
  const [ozError, setOzError] = useState('');

  useEffect(() => {
    fetchConnections();
    fetchCompanies();
  }, [fetchConnections, fetchCompanies]);

  const supported = companies.filter((c) => !UNSUPPORTED.has(c.value));
  const config = supported.find((c) => c.value === company);
  const isBank = config?.group === 'בנקים';
  const isOneZero = config?.otpFlow === true;

  const groups = supported.reduce((acc, c) => {
    (acc[c.group] = acc[c.group] || []).push(c);
    return acc;
  }, {});

  const resetForm = () => {
    setCompany(''); setFields({}); setDisplayName(''); setAutoSync(true); setIncomesOnly(false);
    setOzStep('form'); setOzContext(''); setOzCode(''); setOzError('');
  };

  const onSelectCompany = (value) => {
    setCompany(value);
    setFields({});
    const cfg = supported.find((c) => c.value === value);
    setDisplayName(cfg?.label || '');
    setIncomesOnly(cfg?.group === 'בנקים');
    setOzStep('form'); setOzContext(''); setOzCode(''); setOzError('');
  };

  const saveStandard = async () => {
    setSaving(true);
    const ok = await createConnection({ company, displayName, autoSync, incomesOnly, ...fields });
    setSaving(false);
    if (ok) { setShowAdd(false); resetForm(); }
  };

  // One Zero step 1 — request an SMS code.
  const ozSendCode = async () => {
    setOzBusy(true); setOzError('');
    try {
      const { data } = await api.post('/scrape/onezero/otp/start', { phoneNumber: fields.phoneNumber });
      setOzContext(data.otpContext);
      setOzStep('otp');
    } catch (err) {
      setOzError(err.response?.data?.message || 'שגיאה בשליחת הקוד');
    } finally {
      setOzBusy(false);
    }
  };

  // One Zero step 2 — verify code (server returns a reusable long-term token), then save.
  const ozVerifyAndSave = async () => {
    setOzBusy(true); setOzError('');
    try {
      const { data } = await api.post('/scrape/onezero/otp/verify', {
        otpContext: ozContext, otpCode: ozCode,
        email: fields.email, password: fields.password,
        incomesOnly,
      }, { timeout: 120000 });

      if (!data.otpLongTermToken) throw new Error('לא התקבל טוקן קבוע מ-One Zero');
      const ok = await createConnection({
        company: 'oneZero', displayName, autoSync, incomesOnly,
        email: fields.email, password: fields.password, phoneNumber: fields.phoneNumber,
        otpLongTermToken: data.otpLongTermToken,
      });
      if (ok) { setShowAdd(false); resetForm(); }
    } catch (err) {
      setOzError(err.response?.data?.message || err.message || 'שגיאה באימות הקוד');
    } finally {
      setOzBusy(false);
    }
  };

  const canSaveStandard = company && !isOneZero && (config?.fields || []).every((f) => fields[f.name]);
  const activeCount = connections.filter((c) => c.status === 'active').length;
  const autoSyncCount = connections.filter((c) => c.autoSync).length;
  const attentionCount = connections.filter((c) => c.status === 'error' || c.status === 'needs_otp' || c.lastSyncStatus === 'error').length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#0f1117] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-50">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              חיבורי בנקים
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              חבר חשבון פעם אחת, בדוק את סטטוס הסנכרון, והפעל משיכה ידנית כשצריך.
            </p>
          </div>
          {!showAdd && (
            <Button onClick={() => { setShowAdd(true); resetForm(); }} className="w-full sm:w-auto">
              <Plus className="ml-1 h-4 w-4" /> הוסף חיבור
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-md bg-slate-50 p-3 dark:bg-white/[0.04]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">חיבורים</p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{connections.length}</p>
          </div>
          <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-500/10">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">פעילים</p>
            <p className="mt-1 text-lg font-bold text-emerald-800 dark:text-emerald-200">{activeCount}</p>
          </div>
          <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-500/10">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">דורשים טיפול</p>
            <p className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">{attentionCount}</p>
          </div>
        </div>
      </div>

      {/* ── Add-connection wizard ─────────────────────────────── */}
      {showAdd && (
        <Card className="mb-5 rounded-lg border-blue-200 shadow-sm dark:border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-xl">חיבור חדש</CardTitle>
            <CardDescription>הפרטים נשמרים מוצפנים (AES-256) ומשמשים אך ורק לסנכרון האוטומטי.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">בנק / חברת אשראי</label>
              <Select value={company} onValueChange={onSelectCompany}>
                <SelectTrigger><SelectValue placeholder="בחר חברה" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(groups).map(([group, items]) => (
                    <React.Fragment key={group}>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{group}</div>
                      {items.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config && ozStep === 'form' && (
              <>
                {(config.fields || []).map((f) => (
                  <div key={f.name}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{f.label}</label>
                    <Input
                      type={f.type} inputMode={f.inputMode}
                      value={fields[f.name] || ''}
                      onChange={(e) => setFields((p) => ({ ...p, [f.name]: e.target.value }))}
                      autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">שם תצוגה (אופציונלי)</label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={config.label} />
                </div>

                {isBank && (
                  <label className="flex items-center gap-3 p-3 rounded-md border bg-slate-50 cursor-pointer select-none dark:bg-white/[0.04] dark:border-white/[0.08]">
                    <input type="checkbox" checked={incomesOnly} onChange={(e) => setIncomesOnly(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">הכנסות בלבד
                      <span className="block text-xs font-normal text-slate-400">ייבא רק זיכויים (משכורת, העברות נכנסות)</span>
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-3 p-3 rounded-md border bg-slate-50 cursor-pointer select-none dark:bg-white/[0.04] dark:border-white/[0.08]">
                  <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">סנכרון אוטומטי יומי</span>
                </label>
              </>
            )}

            {isOneZero && ozStep === 'otp' && (
              <div className="space-y-3">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-slate-600">שלחנו קוד אימות ב-SMS למספר:</p>
                  <p className="text-lg font-bold text-slate-800 mt-1">{fields.phoneNumber}</p>
                </div>
                <Input
                  type="text" inputMode="numeric" maxLength={8} autoFocus placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  value={ozCode} onChange={(e) => setOzCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}

            {ozError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />{ozError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => { setShowAdd(false); resetForm(); }}>ביטול</Button>

              {isOneZero ? (
                ozStep === 'form' ? (
                  <Button onClick={ozSendCode} disabled={ozBusy || !fields.email || !fields.password || !fields.phoneNumber}>
                    {ozBusy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Smartphone className="ml-1 h-4 w-4" />}
                    שלח קוד ב-SMS
                  </Button>
                ) : (
                  <Button onClick={ozVerifyAndSave} disabled={ozBusy || ozCode.length < 4}>
                    {ozBusy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="ml-1 h-4 w-4" />}
                    אמת ושמור חיבור
                  </Button>
                )
              ) : (
                <Button onClick={saveStandard} disabled={!canSaveStandard || saving}>
                  {saving ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="ml-1 h-4 w-4" />}
                  שמור חיבור
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Connections list ──────────────────────────────────── */}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white py-16 text-center text-slate-400 shadow-sm dark:border-white/[0.08] dark:bg-[#0f1117]"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>
      ) : connections.length === 0 ? (
        !showAdd && (
          <Card className="rounded-lg shadow-sm"><CardContent className="py-16 text-center text-slate-500">
            <Building2 className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-700 dark:text-slate-200">אין עדיין חיבורים</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">הוסף חיבור כדי להתחיל בסנכרון אוטומטי יומי.</p>
          </CardContent></Card>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{autoSyncCount} מתוך {connections.length} בסנכרון אוטומטי</span>
            <span>עודכן לפי הנתונים האחרונים במערכת</span>
          </div>
          {connections.map((c) => {
            const isSyncing = !!syncing[c._id];
            const label = companies.find((x) => x.value === c.company)?.label || c.company;
            return (
              <Card key={c._id} className="rounded-lg shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{c.displayName || label}</span>
                      <span className="text-xs text-slate-400">{label}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      {c.lastSyncStatus === 'success'
                        ? <CheckCircle className="h-3 w-3 text-green-500" />
                        : c.lastSyncStatus === 'error'
                          ? <AlertTriangle className="h-3 w-3 text-red-500" />
                          : <Clock className="h-3 w-3" />}
                      סונכרן לאחרונה: {fmtDate(c.lastSyncAt)}
                      {c.lastSyncStatus === 'success' && c.lastInserted > 0 && <span className="text-green-600">(+{c.lastInserted})</span>}
                      {c.lastError && <span className="text-red-500 truncate">— {c.lastError}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                    <label className="flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs text-slate-600 cursor-pointer select-none dark:border-white/[0.08] dark:text-slate-300" title="סנכרון אוטומטי יומי">
                      <input
                        type="checkbox" className="h-3.5 w-3.5 accent-blue-600"
                        checked={c.autoSync}
                        onChange={() => updateConnection(c._id, { autoSync: !c.autoSync })}
                      />
                      אוטומטי
                    </label>
                    <Button size="sm" variant="outline" onClick={() => syncConnection(c._id)} disabled={isSyncing}>
                      {isSyncing
                        ? <><Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" />{syncing[c._id] === 'running' ? 'מסנכרן…' : 'בתור…'}</>
                        : <><RefreshCw className="ml-1 h-3.5 w-3.5" />סנכרן עכשיו</>}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => { if (confirm(`למחוק את החיבור "${c.displayName || label}"?`)) deleteConnection(c._id); }}
                      disabled={isSyncing}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
