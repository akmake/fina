import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

/**
 * Two-factor auth management (Phase 4): setup (scan QR) → enable (confirm code) →
 * recovery codes; and disable. Self-contained; talks to /api/auth/2fa/*.
 */
export default function TwoFactorSection() {
  const { user, login } = useAuthStore();
  const [enabled, setEnabled] = useState(null);           // null = loading
  const [step, setStep] = useState('idle');               // idle | setup | recovery
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/account')
      .then(({ data }) => setEnabled(!!data.account.twoFactorEnabled))
      .catch(() => setEnabled(false));
  }, []);

  const syncUser = (twoFactorEnabled) => { if (user) login({ ...user, twoFactorEnabled }); };

  const startSetup = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setQr(data.qr); setSecret(data.secret); setStep('setup');
    } catch (e) { toast.error(e?.response?.data?.message || 'שגיאה בהגדרה'); }
    finally { setBusy(false); }
  };

  const confirmEnable = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/2fa/enable', { code });
      setRecoveryCodes(data.recoveryCodes || []);
      setEnabled(true); setStep('recovery'); setCode(''); syncUser(true);
      toast.success('אימות דו-שלבי הופעל');
    } catch (e) { toast.error(e?.response?.data?.message || 'קוד שגוי'); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api.post('/auth/2fa/disable', { code: disableCode });
      setEnabled(false); setStep('idle'); setDisableCode(''); syncUser(false);
      toast.success('אימות דו-שלבי בוטל');
    } catch (e) { toast.error(e?.response?.data?.message || 'קוד שגוי'); }
    finally { setBusy(false); }
  };

  return (
    <Card className="dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg dark:text-slate-100">
          <ShieldCheck className="h-5 w-5 text-blue-500" />
          אימות דו-שלבי (2FA)
          {enabled === true && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">פעיל</Badge>}
        </CardTitle>
        <CardDescription>שכבת אבטחה נוספת בכניסה — קוד חד-פעמי מאפליקציית אימות.</CardDescription>
      </CardHeader>
      <CardContent>
        {enabled === null && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}

        {/* Off → offer setup */}
        {enabled === false && step === 'idle' && (
          <Button onClick={startSetup} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            הפעל אימות דו-שלבי
          </Button>
        )}

        {/* Setup — scan QR + confirm code */}
        {step === 'setup' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">1. סרוק/י את הקוד באפליקציית אימות (Google Authenticator, Authy…):</p>
            {qr && <img src={qr} alt="QR" className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2" />}
            <p className="text-xs text-slate-400">או הזן/י ידנית: <span className="font-mono select-all">{secret}</span></p>
            <Separator />
            <p className="text-sm text-slate-600 dark:text-slate-300">2. הזן/י את הקוד בן 6 הספרות לאישור:</p>
            <div className="flex items-center gap-2">
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" inputMode="numeric" maxLength={6} className="w-32 text-center tracking-widest" style={{ direction: 'ltr' }} />
              <Button onClick={confirmEnable} disabled={busy || code.length < 6} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} אישור
              </Button>
              <Button variant="ghost" onClick={() => setStep('idle')}>ביטול</Button>
            </div>
          </div>
        )}

        {/* Recovery codes — show once */}
        {step === 'recovery' && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">שמור/י את קודי השחזור במקום בטוח — הם מוצגים פעם אחת בלבד:</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              {recoveryCodes.map((c) => <span key={c} className="select-all">{c}</span>)}
            </div>
            <Button variant="outline" onClick={() => setStep('idle')}>סיימתי לשמור</Button>
          </div>
        )}

        {/* On → offer disable */}
        {enabled === true && step === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">כדי לבטל, הזן/י קוד נוכחי מהאפליקציה (או קוד שחזור):</p>
            <div className="flex items-center gap-2">
              <Input value={disableCode} onChange={e => setDisableCode(e.target.value)} placeholder="קוד" inputMode="numeric" className="w-40" style={{ direction: 'ltr' }} />
              <Button variant="outline" onClick={disable} disabled={busy || !disableCode} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} בטל 2FA
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
