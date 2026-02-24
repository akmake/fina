import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  User, Mail, Shield, Calendar, KeyRound,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import { formatDate } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Avatar with initials
// ---------------------------------------------------------------------------
function Avatar({ name, size = 'lg' }) {
  const initials = (() => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name[0].toUpperCase();
  })();

  const sizeClass = size === 'lg' ? 'h-24 w-24 text-3xl' : 'h-12 w-12 text-lg';

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg`}>
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change password form
// ---------------------------------------------------------------------------
function ChangePasswordForm() {
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.next !== form.confirm) {
      return toast.error('הסיסמאות החדשות אינן תואמות');
    }
    if (form.next.length < 8) {
      return toast.error('הסיסמה חייבת להכיל לפחות 8 תווים');
    }
    try {
      setLoading(true);
      await api.put('/auth/change-password', {
        currentPassword: form.current,
        newPassword: form.next,
      });
      toast.success('הסיסמה עודכנה בהצלחה');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בעדכון הסיסמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current-pw">סיסמה נוכחית</Label>
        <Input
          id="current-pw"
          type="password"
          value={form.current}
          onChange={(e) => setForm((s) => ({ ...s, current: e.target.value }))}
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pw">סיסמה חדשה</Label>
        <Input
          id="new-pw"
          type="password"
          value={form.next}
          onChange={(e) => setForm((s) => ({ ...s, next: e.target.value }))}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-gray-400">לפחות 8 תווים</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-pw">אישור סיסמה חדשה</Label>
        <Input
          id="confirm-pw"
          type="password"
          value={form.confirm}
          onChange={(e) => setForm((s) => ({ ...s, confirm: e.target.value }))}
          required
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <KeyRound className="h-4 w-4 me-2" />}
        {loading ? 'מעדכן...' : 'עדכן סיסמה'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit name form
// ---------------------------------------------------------------------------
function EditNameForm({ currentName, onSaved }) {
  const [name,    setName]    = useState(currentName || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setLoading(true);
      await api.put('/auth/profile', { name: name.trim() });
      toast.success('השם עודכן בהצלחה');
      onSaved(name.trim());
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בעדכון השם');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="השם המלא שלך"
        required
        className="flex-1"
      />
      <Button type="submit" disabled={loading || name === currentName}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שמור'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ProfilePage() {
  const { user, login: updateUser } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handleNameSaved = (newName) => {
    updateUser({ ...user, name: newName });
  };

  const memberSince = user?.createdAt ? formatDate(user.createdAt) : null;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8">

      {/* Page title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">הפרופיל שלי</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">ניהול פרטי החשבון שלך</p>
      </div>

      {/* Profile card */}
      <Card className="dark:bg-slate-900">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar name={user?.name} />
            <div className="flex-1 text-center sm:text-start">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{user?.name || 'משתמש'}</h2>
              <p className="text-gray-500 dark:text-slate-400 mt-1">{user?.email}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                <Badge variant="secondary">
                  <Shield className="h-3 w-3 me-1" />
                  {user?.role === 'admin' ? 'מנהל' : 'משתמש'}
                </Badge>
                {memberSince && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 me-1" />
                    חבר מ-{memberSince}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit info */}
      <Card className="dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-slate-100">
            <User className="h-5 w-5" />
            פרטים אישיים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          <div className="space-y-2">
            <Label>שם מלא</Label>
            <EditNameForm currentName={user?.name} onSaved={handleNameSaved} />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>כתובת מייל</Label>
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-md border border-gray-200 dark:border-slate-700">
              <Mail className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-slate-300 flex-1">{user?.email}</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xs text-gray-400">לא ניתן לשנות את כתובת המייל</p>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-slate-100">
            <KeyRound className="h-5 w-5" />
            אבטחה
          </CardTitle>
          <CardDescription>שנה את הסיסמה שלך</CardDescription>
        </CardHeader>
        <CardContent>
          {showPasswordForm ? (
            <div className="space-y-4">
              <ChangePasswordForm />
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-gray-500"
                onClick={() => setShowPasswordForm(false)}
              >
                ביטול
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
              <KeyRound className="h-4 w-4 me-2" />
              שנה סיסמה
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Account status */}
      <Card className="border-green-200 dark:border-green-900 dark:bg-slate-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">החשבון פעיל</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                החשבון שלך מאומת ופעיל. כל הנתונים מוצפנים ומאובטחים.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
