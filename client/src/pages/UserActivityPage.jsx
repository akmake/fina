import React, { useState, useEffect, useMemo } from 'react';
import api from '@/utils/api';
import { toast } from 'react-hot-toast';
import {
  Users, Monitor, Smartphone, Tablet, HelpCircle, Globe, Clock,
  ChevronDown, ChevronUp, Activity, Search, X, RefreshCw,
  MapPin, Fingerprint, Zap, TrendingUp, Eye, ArrowLeft,
  BarChart3, Calendar, Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════

const DeviceIcon = ({ type, size = 16 }) => {
  let t = type;
  if (typeof type === 'object') {
    t = type.type || type.vendor || type.model || 'unknown';
  }
  const map = { desktop: <Monitor size={size} />, mobile: <Smartphone size={size} />, tablet: <Tablet size={size} /> };
  return map[t] || <HelpCircle size={size} />;
};

const OSIcon = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('windows')) return '🪟';
  if (n.includes('mac') || n.includes('ios')) return '🍎';
  if (n.includes('android')) return '🤖';
  if (n.includes('linux') || n.includes('ubuntu')) return '🐧';
  return '💻';
};

const timeAgo = (date) => {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `לפני ${diff} שניות`;
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  if (diff < 604800) return `לפני ${Math.floor(diff / 86400)} ימים`;
  return new Date(date).toLocaleDateString('he-IL');
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('he-IL') + ' ' + new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const deviceLabel = (d) => {
  if (!d) return 'לא ידוע';
  if (typeof d === 'object') {
    return d.type || d.vendor || d.model || 'לא ידוע';
  }
  if (d === 'desktop') return 'מחשב';
  if (d === 'mobile') return 'נייד';
  if (d === 'tablet') return 'טאבלט';
  return String(d);
};

// ════════════════════════════════════════════
//  SUB-COMPONENTS
// ════════════════════════════════════════════

const StatCard = ({ icon, label, value, color = 'blue', subtitle }) => {
  const c = {
    blue:   'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400',
    green:  'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-400',
    amber:  'from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan:   'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    rose:   'from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-400',
  }[color] || 'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400';

  return (
    <div className={`bg-gradient-to-br ${c} border rounded-2xl p-5 transition-all hover:scale-[1.02] hover:shadow-lg`}>
      <div className="opacity-70 mb-3">{icon}</div>
      <div className="text-3xl font-black text-slate-100 tracking-tight">{value}</div>
      <div className="text-sm text-slate-400 mt-1 font-medium">{label}</div>
      {subtitle && <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
};

const UserRow = ({ user, isExpanded, onToggle }) => {
  return (
    <div className={`border-b border-slate-700/50 transition-all ${isExpanded ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}`}>
      {/* Collapsed row */}
      <div className="px-5 py-4 flex items-center gap-4 cursor-pointer" onClick={onToggle}>
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {user.name?.charAt(0)?.toUpperCase() || '?'}
        </div>

        {/* Name & Email */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-200">{user.name}</span>
            {user.role === 'admin' && (
              <span className="inline-flex items-center gap-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/25 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                <Shield size={9} /> אדמין
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
        </div>

        {/* Quick stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <div className="text-lg font-black text-slate-200">{user.totalVisits}</div>
            <div className="text-[10px] text-slate-500">כניסות</div>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              {user.devices.map((d, i) => (
                <span key={i} className="text-slate-400"><DeviceIcon type={d} size={14} /></span>
              ))}
            </div>
            <div className="text-[10px] text-slate-500">{user.devices.length} התקנים</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-mono text-slate-300">{user.uniqueIPs.length}</div>
            <div className="text-[10px] text-slate-500">כתובות IP</div>
          </div>
        </div>

        {/* Last seen */}
        <div className="text-left shrink-0">
          <div className="text-xs text-slate-400">{timeAgo(user.lastSeen)}</div>
        </div>

        {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-700/30" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">

            {/* 📊 Activity Stats */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-700/40">
                <Activity size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">פעילות</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">סה״כ כניסות</span>
                  <span className="text-sm font-bold text-slate-200">{user.totalVisits}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">דפים ייחודיים</span>
                  <span className="text-sm font-bold text-slate-200">{user.uniquePages}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">זמן תגובה ממוצע</span>
                  <span className="text-sm font-mono text-slate-200">{user.avgResponseTime}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">טביעות אצבע</span>
                  <span className="text-sm font-bold text-slate-200">{user.uniqueFingerprints}</span>
                </div>
              </div>
            </div>

            {/* 📱 Devices & Browsers */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-700/40">
                <Monitor size={14} className="text-emerald-400" />
                <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">מכשירים ודפדפנים</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">התקנים</div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.devices.map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-700/40 text-slate-300 px-2 py-1 rounded-lg text-xs font-medium">
                        <DeviceIcon type={d} size={12} /> {deviceLabel(d)}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">דפדפנים</div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.browsers.map((b, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-1 rounded-lg text-xs font-medium">
                        <Globe size={11} /> {typeof b === 'object' ? (b.name || 'Unknown') : (b || 'Unknown')}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">מערכות הפעלה</div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.operatingSystems.map((os, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-1 rounded-lg text-xs font-medium">
                        <OSIcon name={typeof os === 'object' ? os.name : os} /> {typeof os === 'object' ? (os.name || 'Unknown') : (os || 'Unknown')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 🌐 Network & Location */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-700/40">
                <Globe size={14} className="text-cyan-400" />
                <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">רשת ומיקום</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">כתובות IP</div>
                  <div className="flex flex-wrap gap-1.5">
                    {user.uniqueIPs.map((ip, i) => (
                      <span key={i} className="font-mono text-xs bg-slate-700/40 text-slate-300 px-2 py-1 rounded-lg">
                        {typeof ip === 'object' ? ip.ip || String(ip) : String(ip)}
                      </span>
                    ))}
                    {!user.uniqueIPs.length && <span className="text-xs text-slate-600">—</span>}
                  </div>
                </div>
                {user.locations?.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">מיקומים</div>
                    <div className="flex flex-wrap gap-1.5">
                      {user.locations.map((loc, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-1 rounded-lg text-xs font-medium">
                          <MapPin size={11} /> {typeof loc === 'object' ? `${loc.city || ''}${loc.country ? ` (${loc.country})` : ''}` : String(loc)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-1 border-t border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">כניסה ראשונה</span>
                    <span className="text-xs text-slate-300">{formatDate(user.firstSeen)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-xs text-slate-500">כניסה אחרונה</span>
                    <span className="text-xs text-slate-200 font-bold">{formatDate(user.lastSeen)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════

const UserActivityPage = () => {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [deviceBreakdown, setDeviceBreakdown] = useState({});
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('lastSeen');
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/logs/admin/user-activity', { params: { days } });
      setData(res.data.data || []);
      setSummary(res.data.summary || null);
      setDeviceBreakdown(res.data.deviceBreakdown || {});
    } catch (err) {
      console.error(err);
      toast.error('שגיאה בטעינת נתוני משתמשים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [days]);

  // Filtered & sorted data
  const filteredData = useMemo(() => {
    let list = [...data];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.uniqueIPs?.some(ip => ip.includes(q))
      );
    }

    if (sortBy === 'lastSeen') list.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    if (sortBy === 'totalVisits') list.sort((a, b) => b.totalVisits - a.totalVisits);
    if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
    if (sortBy === 'devices') list.sort((a, b) => b.devices.length - a.devices.length);
    if (sortBy === 'ips') list.sort((a, b) => b.uniqueIPs.length - a.uniqueIPs.length);

    return list;
  }, [data, searchQuery, sortBy]);

  // Total devices count
  const totalDevices = useMemo(() => {
    return Object.values(deviceBreakdown).reduce((s, v) => s + v, 0);
  }, [deviceBreakdown]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ★ HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/admin/logs" className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-slate-200">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 flex items-center gap-3">
                <Users size={28} className="text-blue-400" />
                סיכום פעילות משתמשים
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {summary ? `${summary.totalUsers} משתמשים פעילים · ${summary.totalVisits} כניסות` : 'טוען...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none"
            >
              <option value={7}>7 ימים אחרונים</option>
              <option value={14}>14 ימים אחרונים</option>
              <option value={30}>30 ימים אחרונים</option>
              <option value={60}>60 ימים אחרונים</option>
              <option value={90}>90 ימים אחרונים</option>
            </select>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500/25 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> רענן
            </button>
          </div>
        </div>

        {/* ★ SUMMARY CARDS */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard icon={<Users size={20} />} label="משתמשים פעילים" value={summary.totalUsers} color="blue" />
            <StatCard icon={<Activity size={20} />} label="סה״כ כניסות" value={summary.totalVisits} color="green" />
            <StatCard icon={<TrendingUp size={20} />} label="ממוצע כניסות למשתמש" value={summary.avgVisitsPerUser} color="purple" />
            <StatCard icon={<Monitor size={20} />} label="מחשב" value={deviceBreakdown.desktop || 0} color="cyan" subtitle={`מתוך ${totalDevices}`} />
            <StatCard icon={<Smartphone size={20} />} label="נייד" value={deviceBreakdown.mobile || 0} color="amber" subtitle={`מתוך ${totalDevices}`} />
            <StatCard icon={<Tablet size={20} />} label="טאבלט" value={deviceBreakdown.tablet || 0} color="rose" subtitle={`מתוך ${totalDevices}`} />
          </div>
        )}

        {/* ★ FILTERS */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-700/40 rounded-lg border border-slate-600/30 px-3 gap-2 flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש לפי שם, אימייל או IP..."
                className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-500 py-2 w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="lastSeen">כניסה אחרונה</option>
              <option value="totalVisits">הכי פעיל</option>
              <option value="name">שם</option>
              <option value="devices">מספר התקנים</option>
              <option value="ips">מספר כתובות IP</option>
            </select>
            <div className="flex-1" />
            <span className="text-xs text-slate-500">
              {filteredData.length} משתמשים
            </span>
          </div>
        </div>

        {/* ★ USER LIST */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="bg-slate-800 px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Users size={16} className="text-blue-400" /> רשימת משתמשים
            </span>
            {loading && <RefreshCw size={14} className="animate-spin text-blue-400" />}
          </div>

          {/* Table header */}
          <div className="hidden md:flex items-center gap-4 px-5 py-2.5 bg-slate-800/40 border-b border-slate-700/30 text-[11px] text-slate-500 uppercase tracking-wider font-bold">
            <div className="w-10" />
            <div className="flex-1">משתמש</div>
            <div className="w-20 text-center">כניסות</div>
            <div className="w-24 text-center">התקנים</div>
            <div className="w-16 text-center">IPs</div>
            <div className="w-28 text-left">נראה לאחרונה</div>
            <div className="w-4" />
          </div>

          {loading && !data.length ? (
            <div className="flex justify-center py-16">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3" />
                <p className="text-slate-500 text-sm">טוען נתוני משתמשים...</p>
              </div>
            </div>
          ) : !filteredData.length ? (
            <div className="py-16 text-center">
              <Users size={40} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 font-medium">
                {searchQuery ? 'לא נמצאו משתמשים' : 'אין פעילות משתמשים בתקופה זו'}
              </p>
              <p className="text-slate-600 text-sm mt-1">
                {searchQuery ? 'נסה לשנות את החיפוש' : 'נסה להרחיב את טווח הימים'}
              </p>
            </div>
          ) : (
            <div>
              {filteredData.map((user, idx) => (
                <UserRow
                  key={user.userId || idx}
                  user={user}
                  isExpanded={expandedUser === idx}
                  onToggle={() => setExpandedUser(expandedUser === idx ? null : idx)}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default UserActivityPage;
