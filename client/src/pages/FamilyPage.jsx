import { useState, useEffect } from 'react';
import { Users, Plus, LogIn, LogOut, Copy, Check, Pencil, X, Crown } from 'lucide-react';
import api from '@/utils/api';

export default function FamilyPage() {
  const [group,   setGroup]   = useState(undefined); // undefined=loading, null=no group
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // forms
  const [view,       setView]       = useState('home'); // home | create | join
  const [nameInput,  setNameInput]  = useState('');
  const [codeInput,  setCodeInput]  = useState('');
  const [editName,   setEditName]   = useState(false);
  const [editInput,  setEditInput]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => { fetchGroup(); }, []);

  const fetchGroup = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/family');
      setGroup(data); // null if not in a group
    } catch { setGroup(null); }
    finally  { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!nameInput.trim()) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.post('/family/create', { name: nameInput.trim() });
      setGroup(data); setView('home');
    } catch (e) { setError(e.response?.data?.message || 'שגיאה'); }
    finally { setSaving(false); }
  };

  const handleJoin = async () => {
    if (!codeInput.trim()) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.post('/family/join', { inviteCode: codeInput.trim() });
      setGroup(data); setView('home');
    } catch (e) { setError(e.response?.data?.message || 'קוד לא תקין'); }
    finally { setSaving(false); }
  };

  const handleLeave = async () => {
    if (!confirm('לעזוב את הקבוצה המשפחתית?')) return;
    setSaving(true);
    try {
      await api.post('/family/leave');
      setGroup(null);
    } catch (e) { setError(e.response?.data?.message || 'שגיאה'); }
    finally { setSaving(false); }
  };

  const handleSaveName = async () => {
    if (!editInput.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.put('/family/name', { name: editInput.trim() });
      setGroup(data); setEditName(false);
    } catch { setError('שגיאה בשמירה'); }
    finally { setSaving(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── No group — landing ───────────────────────────────────────
  if (!group) {
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-600 shadow-xl mb-6">
              <Users className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">אזור משפחתי</h1>
            <p className="text-slate-500 text-base leading-relaxed">
              שתפו את אותו חשבון פיננסי עם בן/בת הזוג — עסקאות, תקציב, הלוואות והכל ביחד.
            </p>
          </div>

          {view === 'home' && (
            <div className="space-y-3">
              <button
                onClick={() => { setView('create'); setError(''); setNameInput(''); }}
                className="w-full flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all text-right"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">יצירת קבוצה חדשה</div>
                  <div className="text-sm text-slate-400 mt-0.5">יצרו קבוצה ושלחו קוד לבן/בת הזוג</div>
                </div>
              </button>

              <button
                onClick={() => { setView('join'); setError(''); setCodeInput(''); }}
                className="w-full flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all text-right"
              >
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <LogIn className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">הצטרפות לקבוצה קיימת</div>
                  <div className="text-sm text-slate-400 mt-0.5">הזינו קוד הזמנה שקיבלתם</div>
                </div>
              </button>
            </div>
          )}

          {view === 'create' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">יצירת קבוצה</h2>
                <button onClick={() => setView('home')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1.5">שם הקבוצה</label>
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="למשל: משפחת כהן"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  dir="rtl"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={saving || !nameInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {saving ? 'יוצר...' : 'צור קבוצה'}
              </button>
            </div>
          )}

          {view === 'join' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">הצטרפות לקבוצה</h2>
                <button onClick={() => setView('home')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1.5">קוד הזמנה</label>
                <input
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="A3F9B2C1"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  maxLength={8}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleJoin}
                disabled={saving || codeInput.trim().length < 6}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {saving ? 'מצטרף...' : 'הצטרף לקבוצה'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Has group ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F4F8] px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editInput}
                      onChange={e => setEditInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                      className="bg-white/20 text-white placeholder-white/60 rounded-lg px-3 py-1 text-lg font-bold border border-white/30 focus:outline-none w-44"
                      dir="rtl"
                      autoFocus
                    />
                    <button onClick={handleSaveName} disabled={saving} className="bg-white/20 hover:bg-white/30 rounded-lg p-1.5">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditName(false)} className="bg-white/20 hover:bg-white/30 rounded-lg p-1.5">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">{group.name}</h1>
                    <button
                      onClick={() => { setEditName(true); setEditInput(group.name); }}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <p className="text-white/70 text-sm">{group.members.length} חברים</p>
              </div>
            </div>
          </div>

          {/* Invite code */}
          <div className="bg-white/15 rounded-2xl p-4">
            <p className="text-white/70 text-xs mb-2">קוד הזמנה לשיתוף</p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold tracking-widest">{group.inviteCode}</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-4 py-2 text-sm font-medium"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'הועתק!' : 'העתק'}
              </button>
            </div>
          </div>
        </div>

        {/* Members list */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">חברי הקבוצה</h2>
          <div className="space-y-3">
            {group.members.map(member => {
              const isCreator = member._id === group.createdBy?._id;
              return (
                <div key={member._id} className="flex items-center gap-3">
                  {member.avatar ? (
                    <img src={member.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                      {member.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-900 text-sm">{member.name}</span>
                      {isCreator && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                          <Crown className="h-3 w-3" /> מייסד
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{member.email}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* What's shared */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">מה משותף</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              'עסקאות', 'תקציב', 'הלוואות', 'פנסיה',
              'ביטוחים', 'משכנתה', 'חסכונות', 'מטרות',
              'חובות', 'מניות', 'מעשרות', 'נכסי נדל"ן',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Leave */}
        <button
          onClick={handleLeave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors text-sm font-semibold"
        >
          <LogOut className="h-4 w-4" />
          עזוב את הקבוצה המשפחתית
        </button>

        {error && (
          <p className="text-center text-red-500 text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
