import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import {
  Palette, Bell, Database, LogOut,
  Moon, Sun, Trash2, Download, UserX,
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
import AiAccessSection from '@/components/settings/AiAccessSection';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
const NAV = [
  { id: 'appearance',    label: 'מראה' },
  { id: 'notifications', label: 'התראות' },
  { id: 'plan',          label: 'תוכנית וחיוב' },
  { id: 'security',      label: 'אבטחה' },
  { id: 'ai',            label: 'חיבור לעוזר AI' },
  { id: 'data',          label: 'ניהול נתונים' },
  { id: 'account',       label: 'פעולות חשבון' },
];

function Section({ id, icon: Icon, title, description, children }) {
  return (
    <Card id={id} className="scroll-mt-4 rounded-lg shadow-none dark:bg-slate-900">
      <CardHeader className="border-b border-slate-100 pb-4 dark:border-white/[0.06]">
        <CardTitle className="flex items-center gap-2 text-[15px] dark:text-slate-100">
          <Icon className="h-4 w-4 text-blue-500" />
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

  const handleLogoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
      toast.success('נותקת מכל המכשירים');
    } catch {
      toast.error('שגיאה בניתוק מהמכשירים. נסה שוב.');
      return;
    }
    logout();
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
    <div className="page-shell max-w-6xl space-y-5" dir="rtl">

      {/* Page title */}
      <div className="page-header">
        <div>
          <p className="eyebrow">העדפות מערכת</p>
          <h1 className="page-title">הגדרות</h1>
          <p className="page-description">תצוגה, התראות, אבטחה וניהול נתונים.</p>
        </div>
      </div>

      <div className="grid items-start gap-0 overflow-hidden rounded-[22px] border border-black/[.06] bg-white shadow-[0_18px_60px_rgba(17,17,17,.12)] lg:grid-cols-[220px_minmax(0,1fr)] dark:border-white/[0.07] dark:bg-slate-950">
      <aside className="sticky top-0 hidden min-h-[680px] border-l border-slate-100 bg-[#f6f7fb] p-4 lg:block dark:border-white/[0.07] dark:bg-slate-900">
        <nav aria-label="חלקי ההגדרות" className="space-y-1">
          {NAV.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className="block rounded-md px-3 py-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="space-y-4 p-5 sm:p-7">
      {/* Appearance */}
      <Section id="appearance" icon={Palette} title="מראה" description="מצב תצוגה בהיר או כהה">
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
            <Switch id="dark-mode" checked={isDark} onCheckedChange={toggleDark} aria-label="מצב כהה" />
          </div>
        </div>
      </Section>

      {/* Notifications: Alert model is the in-app store; no per-type preferences exist yet */}
      <Section id="notifications" icon={Bell} title="התראות" description="חריגות תקציב, בעיות סנכרון ועוד מגיעות כהתראות באפליקציה">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ההתראות מופעלות תמיד ומרוכזות במרכז ההתראות. בחירה אישית של סוגי התראות עדיין לא זמינה.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/alerts">פתח את מרכז ההתראות</Link>
          </Button>
        </div>
      </Section>

      {/* Plan / subscription (Phase 4) */}
      <div id="plan" className="scroll-mt-4"><PlanSection /></div>

      {/* Security — 2FA (Phase 4) */}
      <div id="security" className="scroll-mt-4"><TwoFactorSection /></div>

      {/* AI assistant access (MCP) */}
      <div id="ai" className="scroll-mt-4"><AiAccessSection /></div>

      {/* Data management */}
      <Section id="data" icon={Database} title="ניהול נתונים" description="ייצוא, גיבוי ומחיקת הנתונים שלך">
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
      <Section id="account" icon={LogOut} title="פעולות חשבון">
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
      </div>
      </div>

      {/* Confirm logout */}
      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="התנתקות מכל המכשירים"
        description="פעולה זו תנתק אותך מכל המכשירים שמחוברים לחשבון. תצטרך להתחבר מחדש."
        confirmLabel="התנתק"
        onConfirm={handleLogoutAll}
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
