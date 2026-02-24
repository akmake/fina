import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  MessageSquarePlus, Send, ThumbsUp, CheckCircle2,
  Clock, Eye, Loader2, Trash2, ChevronDown, ChevronUp,
  Lightbulb, XCircle, Rocket, AlertCircle
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';

// ---------- Helpers ----------
const STATUS_CONFIG = {
  pending:       { label: 'ממתין',      color: 'bg-amber-100  text-amber-700',   icon: Clock },
  reviewed:      { label: 'נבדק',       color: 'bg-blue-100   text-blue-700',    icon: Eye },
  'in-progress': { label: 'בביצוע',     color: 'bg-purple-100 text-purple-700',  icon: Rocket },
  done:          { label: 'בוצע',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected:      { label: 'נדחה',       color: 'bg-red-100    text-red-700',     icon: XCircle },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
};

// ---------- Main ----------
export default function SuggestionsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- Filter ---
  const [statusFilter, setStatusFilter] = useState('all');

  // --- Fetch ---
  const fetchSuggestions = async () => {
    try {
      const { data } = await api.get('/suggestions');
      setSuggestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuggestions(); }, []);

  // --- Create ---
  const handleSubmit = async () => {
    if (!formTitle.trim() || !formDesc.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/suggestions', { title: formTitle.trim(), description: formDesc.trim() });
      setFormTitle('');
      setFormDesc('');
      setIsFormOpen(false);
      fetchSuggestions();
    } catch (err) {
      alert(err.response?.data?.message || 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Vote ---
  const handleVote = async (id) => {
    try {
      const { data } = await api.post(`/suggestions/${id}/vote`);
      setSuggestions(prev => prev.map(s => s._id === id ? data : s));
    } catch (err) { console.error(err); }
  };

  // --- Status (admin) ---
  const handleStatusChange = async (id, status) => {
    try {
      const { data } = await api.put(`/suggestions/${id}/status`, { status });
      setSuggestions(prev => prev.map(s => s._id === id ? data : s));
    } catch (err) { console.error(err); }
  };

  // --- Reply ---
  const handleReply = async (id, text) => {
    if (!text.trim()) return;
    try {
      const { data } = await api.post(`/suggestions/${id}/replies`, { text });
      setSuggestions(prev => prev.map(s => s._id === id ? data : s));
    } catch (err) { console.error(err); }
  };

  // --- Delete ---
  const handleDelete = async (id) => {
    if (!confirm('למחוק את ההצעה?')) return;
    try {
      await api.delete(`/suggestions/${id}`);
      setSuggestions(prev => prev.filter(s => s._id !== id));
    } catch (err) { console.error(err); }
  };

  // --- Filtered list ---
  const filtered = statusFilter === 'all'
    ? suggestions
    : suggestions.filter(s => s.status === statusFilter);

  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/50 px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200/50">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">הצעות ייעול ושיפור</h1>
            <p className="text-xs text-slate-400 font-medium">עזרו לנו להשתפר — הציעו, הצביעו, הגיבו</p>
          </div>
        </div>
        <Button
          onClick={() => setIsFormOpen(true)}
          className="rounded-full h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/10"
        >
          <MessageSquarePlus className="ml-2 h-4 w-4" />
          הצעה חדשה
        </Button>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { key: 'all', label: 'הכל' },
            ...Object.entries(STATUS_CONFIG).map(([key, val]) => ({ key, label: val.label })),
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                statusFilter === f.key
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white/60 text-slate-500 hover:bg-white hover:shadow-sm border border-white/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-bold">אין הצעות עדיין</p>
            <p className="text-sm mt-1">היו הראשונים להציע שיפור!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(s => (
              <SuggestionCard
                key={s._id}
                suggestion={s}
                currentUser={user}
                isAdmin={isAdmin}
                onVote={handleVote}
                onStatusChange={handleStatusChange}
                onReply={handleReply}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Suggestion Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="rounded-[32px] p-8 border-none shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">הצעה חדשה</DialogTitle>
            <DialogDescription className="text-sm text-slate-400 text-center">שתפו את הרעיון שלכם</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 mr-2">כותרת</label>
              <Input
                className="h-14 rounded-3xl bg-slate-50 border-transparent text-lg px-6"
                placeholder="מה ההצעה?"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 mr-2">תיאור</label>
              <textarea
                className="w-full min-h-[120px] rounded-3xl bg-slate-50 border-transparent p-6 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="ספרו לנו יותר..."
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formTitle.trim() || !formDesc.trim()}
              className="w-full h-12 rounded-3xl bg-slate-900 font-bold text-white"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'שלח הצעה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Card ----------
function SuggestionCard({ suggestion, currentUser, isAdmin, onVote, onStatusChange, onReply, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const hasVoted = suggestion.votes?.includes(currentUser?._id);
  const isOwner = suggestion.user === currentUser?._id;

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    await onReply(suggestion._id, replyText);
    setReplyText('');
    setSendingReply(false);
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/40 shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Main */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={suggestion.status} />
              <span className="text-xs text-slate-400 font-medium">
                {suggestion.userName} · {format(new Date(suggestion.createdAt), 'd בMMM yyyy', { locale: he })}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{suggestion.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{suggestion.description}</p>
          </div>

          {/* Vote */}
          <button
            onClick={() => onVote(suggestion._id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all flex-shrink-0 ${
              hasVoted
                ? 'bg-blue-50 text-blue-600'
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
          >
            <ThumbsUp className={`h-5 w-5 ${hasVoted ? 'fill-blue-600' : ''}`} />
            <span className="text-xs font-bold">{suggestion.votes?.length || 0}</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {/* Admin: Status change */}
          {isAdmin && (
            <Select
              value={suggestion.status}
              onValueChange={(val) => onStatusChange(suggestion._id, val)}
            >
              <SelectTrigger className="h-8 w-[130px] rounded-full text-xs border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Expand replies */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5 rounded-full hover:bg-slate-50"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            תגובות ({suggestion.replies?.length || 0})
          </button>

          {/* Delete */}
          {(isAdmin || isOwner) && (
            <button
              onClick={() => onDelete(suggestion._id)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors px-3 py-1.5 rounded-full hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6 space-y-4">
          {/* Reply list */}
          {suggestion.replies?.length > 0 ? (
            <div className="space-y-3">
              {suggestion.replies.map((r, i) => (
                <div key={r._id || i} className="flex gap-3">
                  <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                    r.role === 'admin'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {r.userName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-700">{r.userName}</span>
                      {r.role === 'admin' && (
                        <Badge className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0 rounded-full">מנהל</Badge>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(r.createdAt), 'd/M HH:mm', { locale: he })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-2">אין תגובות עדיין</p>
          )}

          {/* Reply input */}
          <div className="flex gap-2 pt-2">
            <Input
              className="flex-1 h-10 rounded-full bg-white border-slate-200 text-sm px-4"
              placeholder="כתוב תגובה..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendReply()}
              maxLength={1000}
            />
            <Button
              onClick={handleSendReply}
              disabled={sendingReply || !replyText.trim()}
              size="icon"
              className="h-10 w-10 rounded-full bg-slate-900 hover:bg-slate-800 flex-shrink-0"
            >
              {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
