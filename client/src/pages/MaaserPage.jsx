import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  HandCoins, Plus, Trash2, Settings, X, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Loader2, Save, Tag,
} from 'lucide-react';

// ─── Progress ring ────────────────────────────────────────────
function Ring({ pct }) {
  const r = 52, circ = 2 * Math.PI * r;
  const filled = circ * Math.min(pct / 100, 1);
  const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#3b82f6' : '#f59e0b';
  return (
    <svg width="130" height="130" className="rotate-[-90deg]">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle
        cx="65" cy="65" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

export default function MaaserPage() {
  const [summary,   setSummary]   = useState(null);
  const [donations, setDonations] = useState([]);
  const [settings,  setSettings]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  const [showAdd,      setShowAdd]      = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [addForm, setAddForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], recipient: '', notes: '' });
  const [addSaving, setAddSaving] = useState(false);

  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [allIncomeCategories, setAllIncomeCategories] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sumRes, donRes, setRes, incRes] = await Promise.all([
        api.get('/maaser/summary'),
        api.get('/maaser/donations'),
        api.get('/maaser/settings'),
        api.get('/maaser/income-categories'),
      ]);
      setSummary(sumRes.data);
      setDonations(donRes.data);
      setSettings(setRes.data);
      setAllIncomeCategories(incRes.data || []);
      setSettingsForm({
        percentage:         setRes.data.percentage,
        startDate:          setRes.data.startDate ? setRes.data.startDate.split('T')[0] : '',
        donationCategories: [...setRes.data.donationCategories],
        incomeCategories:   [...(setRes.data.incomeCategories || ['משכורת'])],
      });
    } catch { toast.error('שגיאה בטעינה'); }
    setLoading(false);
  };

  const handleAddDonation = async () => {
    if (!addForm.amount || Number(addForm.amount) <= 0) return toast.error('נא להזין סכום');
    setAddSaving(true);
    try {
      await api.post('/maaser/donations', { ...addForm, amount: Number(addForm.amount) });
      toast.success('נרשמה בהצלחה');
      setShowAdd(false);
      setAddForm({ amount: '', date: new Date().toISOString().split('T')[0], recipient: '', notes: '' });
      fetchAll();
    } catch { toast.error('שגיאה'); }
    setAddSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק תרומה זו?')) return;
    try {
      await api.delete(`/maaser/donations/${id}`);
      toast.success('נמחק');
      fetchAll();
    } catch { toast.error('שגיאה'); }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await api.put('/maaser/settings', {
        ...settingsForm,
        startDate: settingsForm.startDate || null,
        incomeCategories: settingsForm.incomeCategories,
      });
      toast.success('הגדרות נשמרו');
      setShowSettings(false);
      fetchAll();
    } catch { toast.error('שגיאה'); }
    setSettingsSaving(false);
  };

  const addCategory = () => {
    const t = newCategory.trim();
    if (!t || settingsForm.donationCategories.includes(t)) return;
    setSettingsForm(p => ({ ...p, donationCategories: [...p.donationCategories, t] }));
    setNewCategory('');
  };

  const removeCategory = (cat) => {
    setSettingsForm(p => ({ ...p, donationCategories: p.donationCategories.filter(c => c !== cat) }));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  const pct = summary ? Math.round((summary.totalDonated / summary.required) * 100) || 0 : 0;
  const isOwed = summary?.balance > 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-8" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <HandCoins className="h-7 w-7 text-emerald-500" />
            מעשרות
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {settings?.percentage === 20 ? 'חומש (20%)' : 'מעשר (10%)'} ·{' '}
            {settings?.incomeCategories?.length
              ? settings.incomeCategories.join(', ')
              : 'משכורת'}
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Summary card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 mb-5 text-white">
        <div className="flex items-center justify-between">
          {/* Ring */}
          <div className="relative flex items-center justify-center">
            <Ring pct={pct} />
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black">{pct}%</span>
              <span className="text-[10px] text-slate-400 font-medium">שולם</span>
            </div>
          </div>

          {/* Numbers */}
          <div className="flex-1 pr-6 space-y-3">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">הכנסות משכורת</p>
              <p className="text-xl font-bold">{formatCurrency(summary?.totalIncome || 0)}</p>
            </div>
            <div className="h-px bg-white/10" />
            <div>
              <p className="text-[11px] text-slate-400 font-medium">
                נדרש ({settings?.percentage}%)
              </p>
              <p className="text-xl font-bold text-amber-300">{formatCurrency(summary?.required || 0)}</p>
            </div>
            <div className="h-px bg-white/10" />
            <div>
              <p className="text-[11px] text-slate-400 font-medium">שולם / נתרם</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(summary?.totalDonated || 0)}</p>
            </div>
          </div>
        </div>

        {/* Balance banner */}
        <div className={`mt-4 rounded-2xl px-4 py-3 flex items-center gap-3 ${
          isOwed
            ? 'bg-amber-500/20 border border-amber-500/30'
            : 'bg-emerald-500/20 border border-emerald-500/30'
        }`}>
          {isOwed
            ? <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            : <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          }
          <div>
            <p className="text-sm font-bold">
              {isOwed
                ? `יתרה לתרומה: ${formatCurrency(summary?.balance)}`
                : 'עודכנת! אין חוב'}
            </p>
            {!isOwed && summary?.totalDonated > summary?.required && (
              <p className="text-[11px] text-emerald-300 mt-0.5">
                עודף של {formatCurrency(summary.totalDonated - summary.required)} לזכות
              </p>
            )}
          </div>
        </div>

        {summary?.fromDate && (
          <p className="text-[11px] text-slate-500 mt-3 text-center">
            מחושב מ-{format(new Date(summary.fromDate), 'd בMMMM yyyy', { locale: he })}
          </p>
        )}
      </div>

      {/* Add donation button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors mb-5 shadow-sm shadow-emerald-200"
      >
        <Plus className="h-5 w-5" />
        רשום תרומה / צדקה
      </button>

      {/* Donations list */}
      {donations.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <HandCoins className="h-10 w-10 mx-auto mb-3 text-slate-200" />
          <p className="text-sm">עדיין לא נרשמו תרומות</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-500 mb-3">תרומות שנרשמו</h2>
          {donations.map(d => (
            <div key={d._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <HandCoins className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {d.recipient || 'תרומה'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {format(new Date(d.date), 'd בMMM yyyy', { locale: he })}
                    {d.notes && ` · ${d.notes}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-emerald-600">
                  {formatCurrency(d.amount)}
                </span>
                <button
                  onClick={() => handleDelete(d._id)}
                  className="text-slate-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add donation modal ─────────────────────────────────── */}
      {showAdd && (
        <Modal title="רישום תרומה" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <Field label="סכום (₪) *">
              <input
                type="number"
                autoFocus
                value={addForm.amount}
                onChange={e => setAddForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="תאריך">
              <input type="date" value={addForm.date}
                onChange={e => setAddForm(p => ({ ...p, date: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="מי קיבל (אופציונלי)">
              <input value={addForm.recipient}
                onChange={e => setAddForm(p => ({ ...p, recipient: e.target.value }))}
                placeholder="שם ארגון / אדם..." className={inputCls} />
            </Field>
            <Field label="הערות">
              <input value={addForm.notes}
                onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="..." className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowAdd(false)} className={cancelBtn}>ביטול</button>
            <button onClick={handleAddDonation} disabled={addSaving} className={saveBtn}>
              {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              שמור
            </button>
          </div>
        </Modal>
      )}

      {/* ── Settings modal ─────────────────────────────────────── */}
      {showSettings && settingsForm && (
        <Modal title="הגדרות מעשרות" onClose={() => setShowSettings(false)}>
          <div className="space-y-4">

            {/* Percentage */}
            <Field label="אחוז מעשרות">
              <div className="flex gap-2">
                {[10, 20].map(p => (
                  <button
                    key={p}
                    onClick={() => setSettingsForm(f => ({ ...f, percentage: p }))}
                    className={`flex-1 h-10 rounded-xl text-sm font-bold border-2 transition-colors ${
                      settingsForm.percentage === p
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {p}% — {p === 10 ? 'מעשר' : 'חומש'}
                  </button>
                ))}
              </div>
            </Field>

            {/* Income categories */}
            <Field label="הכנסות שחייבות במעשרות">
              {allIncomeCategories.length === 0 ? (
                <p className="text-xs text-slate-400">לא נמצאו קטגוריות הכנסה בעסקאות</p>
              ) : (
                <div className="space-y-2">
                  {allIncomeCategories.map(cat => {
                    const checked = settingsForm.incomeCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSettingsForm(f => ({
                          ...f,
                          incomeCategories: checked
                            ? f.incomeCategories.filter(c => c !== cat)
                            : [...f.incomeCategories, cat],
                        }))}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                          checked
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          checked ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                        }`}>
                          {checked && (
                            <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white fill-current">
                              <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                רק הקטגוריות המסומנות ייכללו בחישוב המעשרות
              </p>
            </Field>

            {/* Start date */}
            <Field label="תאריך תחילת חישוב (ריק = מהעסקה הראשונה)">
              <input type="date" value={settingsForm.startDate}
                onChange={e => setSettingsForm(f => ({ ...f, startDate: e.target.value }))}
                className={inputCls} />
              {settingsForm.startDate && (
                <button
                  onClick={() => setSettingsForm(f => ({ ...f, startDate: '' }))}
                  className="text-xs text-slate-400 hover:text-red-400 mt-1 block"
                >
                  נקה — חזור לעסקה הראשונה
                </button>
              )}
            </Field>

            {/* Donation categories */}
            <Field label="קטגוריות שנחשבות כתרומה">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {settingsForm.donationCategories.map(cat => (
                  <span key={cat} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {cat}
                    <button onClick={() => removeCategory(cat)} className="hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCategory()}
                  placeholder="הוסף קטגוריה..."
                  className={`${inputCls} flex-1`}
                />
                <button onClick={addCategory} className="h-10 px-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                כשתוסיף עסקה באחת מהקטגוריות האלה, המערכת תשאל אם לקזז מהמעשרות
              </p>
            </Field>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowSettings(false)} className={cancelBtn}>ביטול</button>
            <button onClick={handleSaveSettings} disabled={settingsSaving} className={saveBtn}>
              {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              שמור הגדרות
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white';
const saveBtn  = 'flex-1 h-11 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60';
const cancelBtn = 'flex-1 h-11 rounded-2xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[17px] font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
