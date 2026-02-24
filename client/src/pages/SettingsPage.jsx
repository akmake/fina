import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Palette, Bell, Database, LogOut,
  Moon, Sun, Monitor, Trash2, Download,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useState } from 'react';
import toast from 'react-hot-toast';

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
  const [notifyTransact,   setNotifyTransact]   = useState(true);
  const [notifyMonthly,    setNotifyMonthly]    = useState(true);
  const [notifyAnomalies,  setNotifyAnomalies]  = useState(false);

  const handleExportData = () => {
    toast('ייצוא נתונים יהיה זמין בגרסה הבאה', { icon: '📦' });
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

      {/* Data management */}
      <Section icon={Database} title="ניהול נתונים" description="ייצוא וגיבוי הנתונים שלך">
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportData}>
            <Download className="h-4 w-4" />
            ייצוא כל הנתונים (CSV)
          </Button>
          <p className="text-xs text-gray-400">
            ייצוא כולל: עסקאות, קטגוריות, מניות, פקדונות והלוואות.
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
        </div>
      </Section>

      {/* Version badge */}
      <div className="text-center text-xs text-gray-400 dark:text-slate-600 pb-4">
        <p>Fina · גרסה 1.0.0</p>
        <p className="mt-1">נבנה עם ❤️ לניהול פיננסי חכם</p>
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
    </div>
  );
}
