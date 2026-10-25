import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { toast } from 'react-hot-toast';
import { Users, Shield, Trash2, RefreshCw, Search, UserCircle, Lock, Clock, Check, X } from 'lucide-react';

const STATUS_LABEL = { pending: 'ממתין לאישור', approved: 'פעיל', rejected: 'נדחה' };
const STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
// Users created before the approval flow have no status → they are active.
const statusOf = (u) => u.approvalStatus || 'approved';

const fetchUsers = () => api.get('/admin/users').then(r => r.data);

const formatDate = (d) =>
  new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => api.put(`/admin/users/${id}`, { role }),
    onSuccess: () => {
      toast.success('התפקיד עודכן');
      queryClient.invalidateQueries(['admin-users']);
    },
    onError: () => toast.error('שגיאה בעדכון'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('המשתמש נמחק');
      queryClient.invalidateQueries(['admin-users']);
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, decision }) => api.patch(`/admin/users/${id}/approval`, { decision }),
    onSuccess: (_res, { decision }) => {
      toast.success(decision === 'approve' ? 'הגישה אושרה' : 'הבקשה נדחתה');
      queryClient.invalidateQueries(['admin-users']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'שגיאה בעדכון הבקשה'),
  });

  const pending = users.filter(u => statusOf(u) === 'pending');

  const filtered = users.filter(u => statusOf(u) !== 'pending').filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const admins = users.filter(u => u.role === 'admin').length;

  return (
    <div className="page-shell min-h-screen" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">ניהול משתמשים</h1>
            <p className="text-xs text-slate-400">{users.length} משתמשים · {admins} מנהלים{pending.length > 0 ? ` · ${pending.length} ממתינים` : ''}</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          רענן
        </button>
      </div>

      {/* Access requests */}
      {pending.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4" aria-labelledby="pending-title">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 id="pending-title" className="text-sm font-bold text-amber-900 dark:text-amber-200">
              בקשות הצטרפות ממתינות ({pending.length})
            </h2>
          </div>
          <ul className="space-y-2">
            {pending.map(u => (
              <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-100 dark:border-slate-700 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {u.name}
                    {u.googleId && <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">Google</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">{u.email}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">ביקש/ה ב-{formatDate(u.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approvalMutation.mutate({ id: u._id, decision: 'approve' })}
                    disabled={approvalMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> אישור
                  </button>
                  <button
                    onClick={() => { if (confirm(`לדחות את הבקשה של ${u.name}?`)) approvalMutation.mutate({ id: u._id, decision: 'reject' }); }}
                    disabled={approvalMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> דחייה
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם או אימייל..."
          className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">לא נמצאו משתמשים</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">משתמש</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">אימייל</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">תפקיד</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">גישה</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">נרשם</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(user => (
                  <tr key={user._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {user.name?.[0]?.toUpperCase() || <UserCircle className="h-4 w-4" />}
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-100">{user.name}</span>
                        {user.googleId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">Google</span>
                        )}
                        {user.lockUntil && new Date(user.lockUntil) > new Date() && (
                          <Lock className="h-3.5 w-3.5 text-amber-500" title="חשבון נעול" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {user.role === 'admin' && <Shield className="h-3 w-3" />}
                        {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[statusOf(user)]}`}>
                        {STATUS_LABEL[statusOf(user)]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusOf(user) === 'rejected' ? (
                          <button
                            onClick={() => approvalMutation.mutate({ id: user._id, decision: 'approve' })}
                            disabled={approvalMutation.isPending}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30 transition-colors"
                          >
                            אשר גישה
                          </button>
                        ) : (
                          <button
                            onClick={() => { if (confirm(`לחסום את הגישה של ${user.name}? הוא/היא ינותק/תנותק מיד.`)) approvalMutation.mutate({ id: user._id, decision: 'reject' }); }}
                            disabled={approvalMutation.isPending}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            חסום גישה
                          </button>
                        )}
                        <button
                          onClick={() => roleMutation.mutate({ id: user._id, role: user.role === 'admin' ? 'user' : 'admin' })}
                          disabled={roleMutation.isPending}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          {user.role === 'admin' ? 'הורד לרגיל' : 'קדם למנהל'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`למחוק את ${user.name}?`)) deleteMutation.mutate(user._id);
                          }}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
