import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Palette, Bell, Database, LogOut,
  Moon, Sun, Monitor, Trash2, Download, UserX,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import TwoFactorSection from '@/components/settings/TwoFactorSection';
import PlanSection from '@/components/settings/PlanSection';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ icon: Icon, title, description, children }) {
  return (
    <Card className="dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg dark:text-slate-100">
          <Icon className="h-5 w-5 text-blue-500" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { isDark, toggleDark } = useUIStore();
  const { logout }             = useAuthStore();

  const [confirmLogout,    setConfirmLogout]    = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll,      setDeletingAll]      = useState(false);
  const [notifyTransact,   setNotifyTransact]   = useState(true);
  const [notifyMonthly,    setNotifyMonthly]    = useState(true);
  const [notifyAnomalies,  setNotifyAnomalies]  = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletePassword,    setDeletePassword]    = useState('');
  const [deletingAccount,   setDeletingAccount]   = useState(false);

  const handleExportData = async () => {
    try {
      const res = await api.get('/account/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `fina-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('הנתונים יוצאו בהצלחה');
    } catch {
      toast.error('שגיאה בייצוא הנתונים');
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/account', { data: { password: deletePassword, confirm: true } });
      toast.success('החשבון נמחק. להתראות!');
      logout();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'שגיאה במחיקת החשבון');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAllTransactions = async () => {
    setDeletingAll(true);
    try {
      await api.delete('/transactions/all');
      toast.success('כל העסקאות נמחקו בהצלחה');
    } catch {
      toast.error('שגיאה במחיקת העסקאות');
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-8">

      {/* Page title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">הגדרות</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">התאם אישית את חוויית השימוש שלך</p>
      </div>

      {/* Appearance */}
      <Section icon={Palette} title="מראה" description="שלוט בצבעים ובמצב התצוגה">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark
                ? <Moon className="h-5 w-5 text-indigo-400" />
                : <Sun  className="h-5 w-5 text-amber-500" />}
              <div>
                <Label className="text-sm font-medium">מצב כהה</Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isDark ? 'ממשק כהה פעיל' : 'ממשק בהיר פעיל'}
                </p>
              </div>
            </div>
            <Switch checked={isDark} onCheckedChange={toggleDark} />
          </div>

          <Separator />

          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
            <Monitor className="h-4 w-4" />
            <span>עצב מותאם לשפה העברית (RTL) ולאחסון מקומי</span>
          </div>
        </div>
      </Section>

      {/* Notifications (UI-only, future feature) */}
      <Section
        icon={Bell}
        title="התראות"
        description="בחר אילו התראות תרצה לקבל"
      >
        <div className="space-y-4">
          {[
            { id: 'transact', label: 'עסקאות חדשות', desc: 'התראה על כל עסקה חדשה', value: notifyTransact, set: setNotifyTransact },
            { id: 'monthly',  label: 'סיכום חודשי',  desc: 'סיכום הכנסות והוצאות בסוף חודש', value: notifyMonthly,  set: setNotifyMonthly  },
            { id: 'anomaly',  label: 'חריגויות',      desc: 'התראה על הוצאה חריגה', value: notifyAnomalies, set: setNotifyAnomalies },
          ].map(({ id, label, desc, value, set }) => (
            <div key={id} className="flex items-center justify-between">
              <div>
                <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-gray-400">בקרוב</Badge>
                <Switch id={id} checked={value} onCheckedChange={set} disabled />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Plan / subscription (Phase 4) */}
      <PlanSection />

      {/* Security — 2FA (Phase 4) */}
      <TwoFactorSection />

      {/* Data management */}
      <Section icon={Database} title="ניהול נתונים" description="ייצוא, גיבוי ומחיקת הנתונים שלך">
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportData}>
            <Download className="h-4 w-4" />
            ייצוא כל הנתונים (JSON)
          </Button>
          <p className="text-xs text-gray-400">
            ייצוא כולל את כל הנתונים שלך: עסקאות, קטגוריות, תקציבים, יעדים, נכסים והלוואות.
          </p>
          <Separator />
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={deletingAll}
          >
            <Trash2 className="h-4 w-4" />
            מחק את כל העסקאות
          </Button>
          <p className="text-xs text-red-400">
            פעולה בלתי הפיכה. כל העסקאות ייחסכו לצמיתות ויתרות החשבון יאופסו.
          </p>
        </div>
      </Section>

      {/* Account actions */}
      <Section icon={LogOut} title="פעולות חשבון">
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
            onClick={() => setConfirmLogout(true)}
          >
            <LogOut className="h-4 w-4" />
            התנתק מכל המכשירים
          </Button>
          <Separator />
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-red-700 border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
            onClick={() => setDeleteAccountOpen(true)}
          >
            <UserX className="h-4 w-4" />
            מחיקת החשבון לצמיתות
          </Button>
          <p className="text-xs text-red-400">
            מוחק את החשבון ומנתק אותך. הנתונים העסקיים נמחקים והזהות מונגשת. מומלץ לייצא נתונים לפני כן.
          </p>
        </div>
      </Section>

      {/* Version badge */}
      <div className="text-center text-xs text-gray-400 dark:text-slate-600 pb-4">
        <p>Fina · גרסה 1.0.0</p>
        <p className="mt-1">נבנה ע"י DahanWeb </p>
      </div>

      {/* Confirm logout */}
      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="התנתקות מכל המכשירים"
        description="פעולה זו תנתק אותך מכל המכשירים שמחוברים לחשבון. תצטרך להתחבר מחדש."
        confirmLabel="התנתק"
        onConfirm={logout}
      />

      {/* Confirm delete all transactions */}
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="מחיקת כל העסקאות"
        description="פעולה זו תמחק לצמיתות את כל העסקאות שלך ותאפס את יתרות החשבון. אי אפשר לבטל פעולה זו!"
        confirmLabel="מחק הכל"
        onConfirm={handleDeleteAllTransactions}
      />

      {/* Delete account (requires password confirmation) */}
      <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחיקת החשבון לצמיתות</DialogTitle>
            <DialogDescription>
              פעולה זו תמחק את הנתונים העסקיים שלך, תנטרל את הזהות ותנתק אותך. להמשך, הזן/י את הסיסמה שלך.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              placeholder="הסיסמה שלך"
              autoComplete="current-password"
              style={{ direction: 'ltr' }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteAccountOpen(false); setDeletePassword(''); }}>ביטול</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={handleDeleteAccount}
              disabled={deletingAccount || !deletePassword}
            >
              {deletingAccount ? 'מוחק…' : 'מחק את החשבון'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
