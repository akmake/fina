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

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            חיבורי בנקים
          </h1>
          <p className="text-slate-500 mt-1">חבר חשבון פעם אחת — Fina תסנכרן את העסקאות אוטומטית מדי יום.</p>
        </div>
        {!showAdd && (
          <Button onClick={() => { setShowAdd(true); resetForm(); }}>
            <Plus className="ml-1 h-4 w-4" /> הוסף חיבור
          </Button>
        )}
      </div>

      {/* ── Add-connection wizard ─────────────────────────────── */}
      {showAdd && (
        <Card className="mb-6 border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">חיבור חדש</CardTitle>
            <CardDescription>הפרטים נשמרים מוצפנים (AES-256) ומשמשים אך ורק לסנכרון האוטומטי.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">בנק / חברת אשראי</label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                    <Input
                      type={f.type} inputMode={f.inputMode}
                      value={fields[f.name] || ''}
                      onChange={(e) => setFields((p) => ({ ...p, [f.name]: e.target.value }))}
                      autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">שם תצוגה (אופציונלי)</label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={config.label} />
                </div>

                {isBank && (
                  <label className="flex items-center gap-3 p-3 rounded-md border bg-slate-50 cursor-pointer select-none">
                    <input type="checkbox" checked={incomesOnly} onChange={(e) => setIncomesOnly(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                    <span className="text-sm font-medium text-slate-700">הכנסות בלבד
                      <span className="block text-xs font-normal text-slate-400">ייבא רק זיכויים (משכורת, העברות נכנסות)</span>
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-3 p-3 rounded-md border bg-slate-50 cursor-pointer select-none">
                  <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  <span className="text-sm font-medium text-slate-700">סנכרון אוטומטי יומי</span>
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

            <div className="flex justify-end gap-2 pt-2">
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
        <div className="text-center py-16 text-slate-400"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>
      ) : connections.length === 0 ? (
        !showAdd && (
          <Card><CardContent className="py-16 text-center text-slate-500">
            <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            אין עדיין חיבורים. לחץ על "הוסף חיבור" כדי להתחיל בסנכרון אוטומטי.
          </CardContent></Card>
        )
      ) : (
        <div className="space-y-3">
          {connections.map((c) => {
            const isSyncing = !!syncing[c._id];
            const label = companies.find((x) => x.value === c.company)?.label || c.company;
            return (
              <Card key={c._id} className="shadow-sm">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 truncate">{c.displayName || label}</span>
                      <span className="text-xs text-slate-400">{label}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
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

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none" title="סנכרון אוטומטי יומי">
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
