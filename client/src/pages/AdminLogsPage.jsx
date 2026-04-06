import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/utils/api';
import { toast } from 'react-hot-toast';
import {
  Eye, EyeOff, Download, Trash2, RefreshCw, Activity,
  Monitor, Smartphone, Tablet, HelpCircle, Globe, Clock,
  Wifi, Cpu, ChevronDown, ChevronUp, Users, Zap, Search, X, Power, Cookie, MapPin,
  BatteryCharging, Shield, Fingerprint, MousePointer, Sun, Moon, Bot, Video, Mic,
  FileText, Layers, Bell, BellOff, Gauge, HardDrive,
  BarChart3, TrendingUp, Hash, Plug, ScreenShare
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════

const DeviceIcon = ({ type, size = 16 }) => {
  const map = { desktop: <Monitor size={size} />, mobile: <Smartphone size={size} />, tablet: <Tablet size={size} /> };
  return map[type] || <HelpCircle size={size} />;
};

const OSIcon = ({ name }) => {
  const n = (name || '').toLowerCase();
  if (n.includes('windows')) return '🪟';
  if (n.includes('mac') || n.includes('ios')) return '🍎';
  if (n.includes('android')) return '🤖';
  if (n.includes('linux') || n.includes('ubuntu')) return '🐧';
  return '💻';
};

const StatusDot = ({ code }) => {
  if (code >= 200 && code < 300) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />;
  if (code >= 400 && code < 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />;
  if (code >= 500) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />;
};

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `לפני ${diff} שניות`;
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  return new Date(date).toLocaleDateString('he-IL') + ' ' + new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0 שנ׳';
  if (seconds < 60) return `${seconds} שנ׳`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} דק׳`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} שע׳ ${m} דק׳`;
};

const yn = (v) => v === true ? 'כן' : v === false ? 'לא' : '—';
const ynCSV = (v) => v === true ? 'Yes' : v === false ? 'No' : '';

// ════════════════════════════════════════════════════════════
//  SUB COMPONENTS
// ════════════════════════════════════════════════════════════

const StatCard = ({ icon, label, value, color = 'blue', subtitle }) => {
  const c = {
    blue:   'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400',
    green:  'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-400',
    amber:  'from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan:   'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    rose:   'from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-400',
    indigo: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 text-indigo-400',
    teal:   'from-teal-500/10 to-teal-600/5 border-teal-500/20 text-teal-400',
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

const MiniBar = ({ items = [], color = 'blue' }) => {
  const max = items[0]?.count || 1;
  const barColor = {
    blue: 'bg-blue-500', green: 'bg-emerald-500', purple: 'bg-purple-500',
    amber: 'bg-amber-500', cyan: 'bg-cyan-500', rose: 'bg-rose-500',
  }[color] || 'bg-blue-500';

  const getLabel = (id) => {
    if (!id) return 'Unknown';
    if (typeof id === 'object') {
      return id.type || id.vendor || id.model || 'Unknown';
    }
    return String(id);
  };

  return (
    <div className="space-y-2.5">
      {items.slice(0, 6).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-sm text-slate-300 w-28 truncate text-left font-medium" title={getLabel(item._id)}>
            {getLabel(item._id)}
          </span>
          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }} />
          </div>
          <span className="text-xs text-slate-400 font-mono w-8 text-left">{item.count}</span>
        </div>
      ))}
    </div>
  );
};

const SectionHeader = ({ icon, title, color = 'text-blue-400' }) => (
  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-700/40">
    <span className={color}>{icon}</span>
    <span className="text-xs font-bold text-slate-300 tracking-wide uppercase">{title}</span>
  </div>
);

const Detail = ({ icon, label, value, mono, small, className = '' }) => (
  <div className={className}>
    <div className="flex items-center gap-1 text-slate-500 text-[11px] mb-0.5">{icon}<span>{label}</span></div>
    <div className={`text-slate-200 ${mono ? 'font-mono' : ''} ${small ? 'text-[11px] break-all' : 'text-sm'}`}>
      {value ?? '—'}
    </div>
  </div>
);

const Badge = ({ icon, text, color }) => (
  <span className={`inline-flex items-center gap-1 ${color} px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap`}>
    {icon} {text}
  </span>
);

// ════════════════════════════════════════════════════════════
//  LOG ROW — Collapsed + expanded detail view
// ════════════════════════════════════════════════════════════

const LogRow = ({ log, isExpanded, onToggle }) => {
  const hasFP = log.fingerprint || log.canvasFingerprint || log.webglFingerprint || log.fontFingerprint || log.audioFingerprint;

  return (
    <div className={`border-b border-slate-700/50 transition-all cursor-pointer ${isExpanded ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'}`} onClick={onToggle}>
      {/* ── Collapsed row ── */}
      <div className="px-5 py-3.5 flex items-center gap-4">
        <div className="text-slate-400 shrink-0"><DeviceIcon type={log.device} size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-slate-200">{log.ipAddress}</span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-sm text-slate-400">{log.browser?.name || '?'} {log.browser?.version?.split('.')[0] || ''}</span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-sm text-slate-400"><OSIcon name={log.os?.name} /> {log.os?.name || '?'}</span>
            {log.location?.city && log.location.city !== 'Unknown' && (
              <>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-sm text-slate-500 flex items-center gap-0.5"><MapPin size={11} /> {log.location.city}</span>
              </>
            )}
            {hasFP && <Fingerprint size={12} className="text-indigo-400 opacity-60" />}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            <span className={`font-bold mr-1 ${log.method === 'GET' ? 'text-emerald-500/70' : log.method === 'POST' ? 'text-amber-500/70' : log.method === 'DELETE' ? 'text-red-500/70' : 'text-blue-500/70'}`}>
              {log.method}
            </span>
            {log.page}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Quick mini badges */}
          <div className="hidden lg:flex items-center gap-1.5">
            {log.webdriver && <span title="בוט / אוטומציה" className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center"><Bot size={10} className="text-orange-300" /></span>}
            {log.adBlocker && <span title="Ad Blocker" className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center"><Shield size={10} className="text-red-300" /></span>}
            {log.isTouchDevice && <span title="Touch" className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center"><MousePointer size={10} className="text-purple-300" /></span>}
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot code={log.statusCode} />
            <span className="text-xs font-mono text-slate-400">{log.statusCode}</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">{log.responseTime}ms</span>
          <span className="text-xs text-slate-500 hidden sm:block">{timeAgo(log.timestamp)}</span>
          {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-700/30" onClick={(e) => e.stopPropagation()}>

          {/* ★ BADGES */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {log.userId && <Badge icon={<Users size={10} />} text={log.userId?.name || 'משתמש רשום'} color="bg-blue-500/15 text-blue-300 border border-blue-500/25" />}
            {log.session?.isNewSession && <Badge icon="✨" text="סשן חדש" color="bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" />}
            {log.isTouchDevice && <Badge icon={<MousePointer size={10} />} text="מסך מגע" color="bg-purple-500/15 text-purple-300 border border-purple-500/25" />}
            {log.prefersDarkMode === true && <Badge icon={<Moon size={10} />} text="מצב כהה" color="bg-slate-500/20 text-slate-300 border border-slate-500/25" />}
            {log.prefersDarkMode === false && <Badge icon={<Sun size={10} />} text="מצב בהיר" color="bg-amber-500/15 text-amber-300 border border-amber-500/25" />}
            {log.doNotTrack && <Badge icon={<Shield size={10} />} text="DNT" color="bg-rose-500/15 text-rose-300 border border-rose-500/25" />}
            {log.adBlocker && <Badge icon={<Shield size={10} />} text="Ad Blocker" color="bg-red-500/15 text-red-300 border border-red-500/25" />}
            {log.webdriver && <Badge icon={<Bot size={10} />} text="בוט/אוטומציה" color="bg-orange-500/15 text-orange-300 border border-orange-500/25" />}
            {log.battery?.charging && <Badge icon={<BatteryCharging size={10} />} text="בטעינה" color="bg-green-500/15 text-green-300 border border-green-500/25" />}
            {log.isOnline === false && <Badge icon={<Wifi size={10} />} text="אופליין" color="bg-red-500/15 text-red-300 border border-red-500/25" />}
            {log.prefersReducedMotion && <Badge icon={<Gauge size={10} />} text="אנימציות מופחתות" color="bg-teal-500/15 text-teal-300 border border-teal-500/25" />}
            {log.connection?.saveData && <Badge icon={<Wifi size={10} />} text="חיסכון בנתונים" color="bg-yellow-500/15 text-yellow-300 border border-yellow-500/25" />}
            {log.webGLSupported === false && <Badge icon={<Layers size={10} />} text="ללא WebGL" color="bg-gray-500/15 text-gray-300 border border-gray-500/25" />}
            {log.pdfViewerEnabled && <Badge icon={<FileText size={10} />} text="PDF Viewer" color="bg-indigo-500/15 text-indigo-300 border border-indigo-500/25" />}
            {log.serviceWorkerSupported && <Badge icon={<Zap size={10} />} text="SW" color="bg-cyan-500/15 text-cyan-300 border border-cyan-500/25" />}
            {log.notificationPermission === 'granted' && <Badge icon={<Bell size={10} />} text="התראות מאושרות" color="bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" />}
            {log.notificationPermission === 'denied' && <Badge icon={<BellOff size={10} />} text="התראות חסומות" color="bg-red-500/15 text-red-300 border border-red-500/25" />}
            {log.privateMode === true && <Badge icon="🕵️" text="מצב פרטי" color="bg-slate-500/20 text-slate-300 border border-slate-500/25" />}
            {log.devToolsOpen === true && <Badge icon="🛠️" text="DevTools פתוח" color="bg-yellow-500/15 text-yellow-300 border border-yellow-500/25" />}
            {log.vmIndicators?.length > 0 && <Badge icon="🖥️" text="VM ייתכן" color="bg-orange-500/15 text-orange-300 border border-orange-500/25" />}
            {log.location?.isProxy === true && <Badge icon="🔀" text="Proxy/VPN" color="bg-rose-500/15 text-rose-300 border border-rose-500/25" />}
            {log.location?.isHosting === true && <Badge icon="☁️" text="Hosting/DC" color="bg-blue-500/15 text-blue-300 border border-blue-500/25" />}
            {log.prefersHighContrast && <Badge icon="🔲" text="ניגודיות גבוהה" color="bg-slate-500/20 text-slate-300 border border-slate-500/25" />}
            {log.webAssemblySupported && <Badge icon={<Zap size={10} />} text="WASM" color="bg-violet-500/15 text-violet-300 border border-violet-500/25" />}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* 🌐 Network & Location */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Globe size={14} />} title="רשת ומיקום" color="text-blue-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Globe size={12} />} label="IP" value={log.ipAddress} mono />
                  {log.location?.country && (
                    <Detail icon={<MapPin size={12} />} label="מיקום" value={`${log.location.city || ''} ${log.location.region ? `· ${log.location.region}` : ''} ${log.location.country ? `(${log.location.country})` : ''}`.trim()} />
                  )}
                  {log.location?.latitude != null && log.location?.longitude != null && (
                    <Detail icon={<MapPin size={12} />} label="קואורדינטות" value={`${log.location.latitude?.toFixed(4)}, ${log.location.longitude?.toFixed(4)}`} mono small />
                  )}
                  {log.location?.isp && <Detail icon={<Wifi size={12} />} label="ISP" value={log.location.isp} />}
                  {log.location?.org && log.location.org !== log.location.isp && <Detail icon={<Globe size={12} />} label="ארגון" value={log.location.org} small />}
                  {log.location?.asn && <Detail label="ASN" value={log.location.asn} mono small />}
                  {log.location?.zip && <Detail label="מיקוד" value={log.location.zip} mono />}
                  {log.location?.timezone && <Detail icon={<Clock size={12} />} label="אזור זמן (IP)" value={log.location.timezone} />}
                  {log.location?.isProxy != null && (
                    <Detail label="Proxy/VPN" value={log.location.isProxy ? '⚠️ כן' : 'לא'} />
                  )}
                  {log.location?.isMobile != null && (
                    <Detail label="רשת סלולרית" value={yn(log.location.isMobile)} />
                  )}
                  {log.connection?.effectiveType && <Detail icon={<Wifi size={12} />} label="חיבור" value={log.connection.effectiveType.toUpperCase()} />}
                  {log.connection?.rtt != null && <Detail icon={<Zap size={12} />} label="RTT" value={`${log.connection.rtt}ms`} mono />}
                  {log.connection?.downlink != null && <Detail icon={<Zap size={12} />} label="Downlink" value={`${log.connection.downlink} Mbps`} mono />}
                  <Detail icon={<Wifi size={12} />} label="אונליין" value={yn(log.isOnline)} />
                  {log.localIPs?.length > 0 && (
                    <Detail label="IPs מקומיים (WebRTC)" value={log.localIPs.join(', ')} mono small className="col-span-2" />
                  )}
                </div>
              </div>

              {/* 🖥️ System */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Monitor size={14} />} title="מערכת" color="text-emerald-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Monitor size={12} />} label="מערכת הפעלה" value={`${log.os?.name || '?'} ${log.os?.version || ''}`} />
                  <Detail icon={<Globe size={12} />} label="דפדפן" value={`${log.browser?.name || '?'} ${log.browser?.version || ''}`} />
                  <Detail icon={<DeviceIcon type={log.device} size={12} />} label="סוג התקן" value={log.device} />
                  {log.platform && <Detail label="פלטפורמה" value={log.platform} />}
                  {log.os?.architecture && <Detail label="ארכיטקטורה" value={log.os.architecture} />}
                </div>
              </div>

              {/* 📺 Screen */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<ScreenShare size={14} />} title="תצוגה / מסך" color="text-purple-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Monitor size={12} />} label="רזולוציה" value={log.screen?.width ? `${log.screen.width} × ${log.screen.height}` : '—'} />
                  {log.screen?.availWidth && <Detail label="שטח זמין" value={`${log.screen.availWidth} × ${log.screen.availHeight}`} />}
                  {log.screen?.colorDepth && <Detail label="Color Depth" value={`${log.screen.colorDepth} bit`} mono />}
                  {log.screen?.pixelDepth && <Detail label="Pixel Depth" value={`${log.screen.pixelDepth} bit`} mono />}
                  {log.screen?.pixelRatio && <Detail label="Pixel Ratio" value={`${log.screen.pixelRatio}x`} mono />}
                  {log.screen?.isRetina != null && <Detail label="רטינה" value={yn(log.screen.isRetina)} />}
                  {log.screen?.refreshRate && <Detail label="קצב רענון" value={`${log.screen.refreshRate} Hz`} mono />}
                  {log.screen?.orientation && (
                    <Detail label="כיוון מסך" value={log.screen.orientation.includes('landscape') ? 'לרוחב' : log.screen.orientation.includes('portrait') ? 'לאורך' : log.screen.orientation} />
                  )}
                  {log.screen?.viewportWidth && <Detail label="Viewport" value={`${log.screen.viewportWidth} × ${log.screen.viewportHeight}`} mono />}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

              {/* ⚙️ Hardware */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Cpu size={14} />} title="חומרה" color="text-amber-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {(log.processor?.cores || log.hardwareConcurrency) && (
                    <Detail icon={<Cpu size={12} />} label="ליבות CPU" value={log.processor?.cores || log.hardwareConcurrency} />
                  )}
                  {log.deviceMemory && <Detail icon={<HardDrive size={12} />} label="זיכרון RAM" value={`${log.deviceMemory} GB`} />}
                  {log.gpu?.vendor && <Detail icon={<Layers size={12} />} label="GPU יצרן" value={log.gpu.vendor} />}
                  {log.gpu?.renderer && <Detail icon={<Layers size={12} />} label="GPU" value={log.gpu.renderer} small />}
                  {log.battery?.level != null && (
                    <Detail icon={<BatteryCharging size={12} />} label="סוללה" value={`${log.battery.level}%${log.battery.charging ? ' ⚡' : ''}`} />
                  )}
                  {log.processor?.maxTouchPoints != null && (
                    <Detail label="Touch Points" value={log.processor.maxTouchPoints} mono />
                  )}
                </div>
              </div>

              {/* 🔐 Storage & Cookies */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Cookie size={14} />} title="אחסון ועוגיות" color="text-cyan-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Detail icon={<Cookie size={12} />} label="עוגיות" value={log.cookies?.enabled != null ? `${log.cookies.enabled ? 'מופעל' : 'חסום'} · ${log.cookies.count ?? 0}` : '—'} />
                  <Detail icon={<HardDrive size={12} />} label="LocalStorage" value={yn(log.localStorage?.enabled)} />
                  {log.pluginsCount != null && <Detail icon={<Plug size={12} />} label="תוספים" value={log.pluginsCount} />}
                  {log.storageQuota?.quotaMB != null && (
                    <Detail icon={<HardDrive size={12} />} label="מכסת אחסון" value={`${log.storageQuota.quotaMB} MB`} mono />
                  )}
                  {log.storageQuota?.usedMB != null && (
                    <Detail label="שימוש באחסון" value={`${log.storageQuota.usedMB} MB`} mono />
                  )}
                  {log.privateMode != null && (
                    <Detail label="מצב פרטי" value={log.privateMode ? '🕵️ כן (ייתכן)' : 'לא'} />
                  )}
                  {log.keyboardLayout && <Detail label="פריסת מקלדת" value={log.keyboardLayout} mono />}
                  {log.screenRefreshRate && <Detail label="קצב רענון" value={`${log.screenRefreshRate} Hz`} mono />}
                </div>
              </div>

              {/* 🎯 Session */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Activity size={14} />} title="סשן" color="text-rose-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {log.session?.pageViews != null && <Detail icon={<FileText size={12} />} label="דפים" value={log.session.pageViews} />}
                  {log.session?.durationSeconds != null && <Detail icon={<Clock size={12} />} label="משך" value={formatDuration(log.session.durationSeconds)} />}
                  {log.session?.isNewSession != null && <Detail label="סשן חדש" value={yn(log.session.isNewSession)} />}
                </div>
              </div>

              {/* 🎤 Media Devices */}
              {log.mediaDevices && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                  <SectionHeader icon={<Video size={14} />} title="מכשירי מדיה" color="text-indigo-400" />
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                    <Detail icon={<Video size={12} />} label="מצלמות" value={log.mediaDevices.cameras ?? 0} />
                    <Detail icon={<Mic size={12} />} label="מיקרופונים" value={log.mediaDevices.microphones ?? 0} />
                    <Detail label="רמקולים" value={log.mediaDevices.speakers ?? 0} />
                  </div>
                </div>
              )}

              {/* 🌍 Language / Timezone */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                <SectionHeader icon={<Globe size={14} />} title="שפה ואזור זמן" color="text-teal-400" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {log.userLanguage && <Detail label="שפה ראשית" value={log.userLanguage} />}
                  {log.languages?.length > 1 && <Detail label="שפות" value={log.languages.join(', ')} small />}
                  {log.timezone && <Detail icon={<Clock size={12} />} label="אזור זמן" value={log.timezone} />}
                </div>
              </div>
            </div>
          </div>

          {/* ★ FINGERPRINTS — Full width */}
          {hasFP && (
            <div className="mt-4 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-xl p-4 border border-indigo-500/20">
              <SectionHeader icon={<Fingerprint size={14} />} title="טביעות אצבע דיגיטליות" color="text-indigo-400" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {log.fingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Visitor Fingerprint</div>
                    <div className="font-mono text-sm text-indigo-300 font-bold">{log.fingerprint}</div>
                  </div>
                )}
                {log.canvasFingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Canvas Fingerprint</div>
                    <div className="font-mono text-sm text-purple-300 font-bold">{log.canvasFingerprint}</div>
                  </div>
                )}
                {log.webglFingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">WebGL Fingerprint</div>
                    <div className="font-mono text-sm text-violet-300 font-bold">{log.webglFingerprint}</div>
                  </div>
                )}
                {log.fontFingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Font Fingerprint</div>
                    <div className="font-mono text-sm text-pink-300 font-bold">{log.fontFingerprint}</div>
                  </div>
                )}
                {log.audioFingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Audio Fingerprint</div>
                    <div className="font-mono text-sm text-cyan-300 font-bold">{log.audioFingerprint}</div>
                  </div>
                )}
                {log.speechVoicesFingerprint && (
                  <div className="bg-slate-800/60 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 mb-0.5">Speech Voices FP</div>
                    <div className="font-mono text-sm text-teal-300 font-bold">{log.speechVoicesFingerprint}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ★ Browser Capabilities */}
          <div className="mt-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <SectionHeader icon={<Zap size={14} />} title="יכולות דפדפן" color="text-yellow-400" />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                { label: 'WebGL', val: log.webGLSupported },
                { label: 'WebGL 2', val: log.webGL2Supported },
                { label: 'Service Worker', val: log.serviceWorkerSupported },
                { label: 'PDF Viewer', val: log.pdfViewerEnabled },
                { label: 'עוגיות', val: log.cookies?.enabled },
                { label: 'LocalStorage', val: log.localStorage?.enabled },
                { label: 'IndexedDB', val: log.indexedDBSupported },
                { label: 'WebAssembly', val: log.webAssemblySupported },
                { label: 'SharedArrayBuffer', val: log.sharedArrayBufferSupported },
                { label: 'BigInt', val: log.bigIntSupported },
              ].map(({ label, val }) => (
                <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${val === true ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : val === false ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-slate-700/30 text-slate-500 border border-slate-600/20'}`}>
                  {val === true ? <Eye size={12} /> : val === false ? <EyeOff size={12} /> : <HelpCircle size={12} />}
                  {label}
                </div>
              ))}
            </div>
            {log.notificationPermission && (
              <div className="mt-2 text-xs text-slate-400">
                התראות: <span className={`font-bold ${log.notificationPermission === 'granted' ? 'text-emerald-300' : log.notificationPermission === 'denied' ? 'text-red-300' : 'text-slate-300'}`}>{log.notificationPermission}</span>
              </div>
            )}
            {log.cryptoCapabilities?.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] text-slate-500 mb-1">Crypto Algorithms</div>
                <div className="flex flex-wrap gap-1.5">
                  {log.cryptoCapabilities.map(alg => (
                    <span key={alg} className="px-2 py-0.5 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded text-[10px] font-mono">{alg}</span>
                  ))}
                </div>
              </div>
            )}
            {log.mediaCodecs && (
              <div className="mt-3">
                <div className="text-[10px] text-slate-500 mb-1">Media Codecs</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(log.mediaCodecs).map(([codec, support]) => (
                    <span key={codec} className={`px-2 py-0.5 rounded text-[10px] font-mono border ${support === 'probably' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : support === 'maybe' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' : 'bg-slate-700/30 text-slate-500 border-slate-600/20'}`}>
                      {codec}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ★ Security Intelligence */}
          {(log.vmIndicators?.length > 0 || log.automationIndicators?.length > 0 || log.devToolsOpen != null || log.permissionStates) && (
            <div className="mt-4 bg-gradient-to-r from-rose-500/5 to-orange-500/5 rounded-xl p-4 border border-rose-500/20">
              <SectionHeader icon={<Shield size={14} />} title="אינטיליגנציית אבטחה" color="text-rose-400" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2.5">
                  {log.devToolsOpen != null && (
                    <Detail label="DevTools פתוח" value={log.devToolsOpen ? '⚠️ כן' : 'לא'} />
                  )}
                  {log.vmIndicators?.length > 0 && (
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">אינדיקטורי VM</div>
                      <div className="flex flex-wrap gap-1">
                        {log.vmIndicators.map(v => <span key={v} className="px-2 py-0.5 bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded text-[10px] font-mono">{v}</span>)}
                      </div>
                    </div>
                  )}
                  {log.automationIndicators?.length > 0 && (
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">אינדיקטורי אוטומציה</div>
                      <div className="flex flex-wrap gap-1">
                        {log.automationIndicators.map(v => <span key={v} className="px-2 py-0.5 bg-red-500/10 text-red-300 border border-red-500/20 rounded text-[10px] font-mono">{v}</span>)}
                      </div>
                    </div>
                  )}
                </div>
                {log.permissionStates && (
                  <div>
                    <div className="text-[11px] text-slate-500 mb-1.5">הרשאות דפדפן</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(log.permissionStates).map(([perm, state]) => (
                        <div key={perm} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${state === 'granted' ? 'bg-emerald-400' : state === 'denied' ? 'bg-red-400' : 'bg-slate-500'}`} />
                          <span className="text-[10px] text-slate-400 truncate">{perm}</span>
                          <span className={`text-[10px] font-bold ${state === 'granted' ? 'text-emerald-400' : state === 'denied' ? 'text-red-400' : 'text-slate-500'}`}>{state === 'granted' ? '✓' : state === 'denied' ? '✗' : '?'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ★ Request Info */}
          <div className="mt-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
            <SectionHeader icon={<FileText size={14} />} title="פרטי בקשה" color="text-slate-400" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5">
              <Detail icon={<Clock size={12} />} label="זמן מדויק" value={new Date(log.timestamp).toLocaleString('he-IL')} />
              <Detail icon={<Zap size={12} />} label="זמן תגובה" value={`${log.responseTime}ms`} mono />
              <Detail label="סטטוס" value={log.statusCode} mono />
              <Detail label="Method" value={log.method} mono />
              {log.referer && <Detail label="הגיע מ-" value={log.referer} className="col-span-2" small />}
            </div>
            <div className="mt-2">
              <Detail label="User Agent" value={log.userAgent} className="col-span-full" mono small />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════

const AdminLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [togglingLogging, setTogglingLogging] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [filterDevice, setFilterDevice] = useState('all');
  const [searchIP, setSearchIP] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedLog, setExpandedLog] = useState(null);

  // ★ Computed stats from loaded logs
  const computedStats = useMemo(() => {
    if (!logs.length) return null;
    const fps = new Set();
    const canvasFPs = new Set();
    let bots = 0, adBlock = 0, touch = 0, dark = 0, dnt = 0;
    let withGPU = 0, withBattery = 0, withSession = 0;
    let proxies = 0, vms = 0, devtools = 0, privateMode = 0;

    logs.forEach(l => {
      if (l.fingerprint) fps.add(l.fingerprint);
      if (l.canvasFingerprint) canvasFPs.add(l.canvasFingerprint);
      if (l.webdriver || l.automationIndicators?.length) bots++;
      if (l.adBlocker) adBlock++;
      if (l.isTouchDevice) touch++;
      if (l.prefersDarkMode) dark++;
      if (l.doNotTrack) dnt++;
      if (l.gpu?.renderer) withGPU++;
      if (l.battery?.level != null) withBattery++;
      if (l.session?.pageViews) withSession++;
      if (l.location?.isProxy) proxies++;
      if (l.vmIndicators?.length) vms++;
      if (l.devToolsOpen) devtools++;
      if (l.privateMode) privateMode++;
    });

    return {
      uniqueFingerprints: fps.size,
      uniqueCanvasFingerprints: canvasFPs.size,
      bots, adBlock, touch, dark, dnt, withGPU, withBattery, withSession,
      proxies, vms, devtools, privateMode,
      dataQuality: Math.round((withSession / logs.length) * 100),
    };
  }, [logs]);

  // ★ Status fetch
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/logs/admin/status');
        setLoggingEnabled(res.data.loggingEnabled);
      } catch (err) {
        console.error('Error fetching logging status:', err);
      } finally {
        setStatusLoaded(true);
      }
    };
    fetchStatus();
  }, []);

  // ★ Toggle logging
  const handleToggleLogging = async () => {
    setTogglingLogging(true);
    try {
      const res = await api.post('/logs/admin/toggle', { enabled: !loggingEnabled });
      setLoggingEnabled(res.data.loggingEnabled);
      toast.success(res.data.loggingEnabled ? '✅ המעקב הופעל — כל כניסה תירשם' : '⛔ המעקב כבוי — לא נשמר כלום');
    } catch (err) {
      toast.error('שגיאה בשינוי ההגדרה');
    } finally {
      setTogglingLogging(false);
    }
  };

  // Fetch summary
  useEffect(() => {
    if (!loggingEnabled || !statusLoaded) return;
    const fetchSummary = async () => {
      try {
        const res = await api.get('/logs/admin/summary');
        setSummary(res.data);
      } catch (err) { console.error(err); }
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 15000);
    return () => clearInterval(interval);
  }, [loggingEnabled, statusLoaded]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!loggingEnabled) return;
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filterDevice !== 'all') params.device = filterDevice;
      if (searchIP) params.ipAddress = searchIP;

      const res = await api.get('/logs/admin/all', { params });
      let data = res.data.data;

      if (sortBy === 'newest') data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (sortBy === 'oldest') data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      if (sortBy === 'slowest') data.sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0));

      setLogs(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [loggingEnabled, filterDevice, searchIP, sortBy]);

  useEffect(() => {
    if (!loggingEnabled || !statusLoaded) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs, statusLoaded]);

  // ★ CSV Export — all 60+ columns
  const handleExportCSV = () => {
    if (!logs.length) return toast.error('אין לוגים');

    const headers = [
      'Time', 'IP', 'Country', 'Country Code', 'City', 'Region', 'ZIP', 'Lat', 'Lon', 'ISP', 'ASN', 'Org', 'Proxy/VPN', 'Mobile Network', 'Hosting/DC',
      'Browser', 'Browser Version', 'OS', 'OS Version', 'Device', 'Platform', 'Architecture',
      'Screen W', 'Screen H', 'Avail W', 'Avail H', 'Color Depth', 'Pixel Ratio', 'Retina', 'Refresh Rate', 'Orientation',
      'CPU Cores', 'RAM (GB)', 'GPU Vendor', 'GPU Renderer', 'Touch Points',
      'Battery %', 'Charging', 'Battery Charging Time (s)', 'Battery Discharging Time (s)',
      'Connection', 'RTT (ms)', 'Downlink (Mbps)', 'Save Data',
      'Local IPs (WebRTC)',
      'Cookies', 'Cookie Count', 'LocalStorage', 'Storage Quota (MB)', 'Storage Used (MB)', 'Private Mode',
      'Language', 'Languages', 'Timezone', 'Keyboard Layout',
      'Dark Mode', 'High Contrast', 'Touch', 'DNT', 'Reduced Motion', 'Online',
      'Ad Blocker', 'Bot/Webdriver', 'Automation Indicators', 'DevTools Open', 'VM Indicators', 'PDF Viewer', 'Plugins', 'Gamepad',
      'WebGL', 'WebGL2', 'Service Worker', 'IndexedDB', 'WebAssembly', 'SharedArrayBuffer', 'BigInt', 'Notifications', 'Crypto Algorithms',
      'Fingerprint', 'Canvas FP', 'WebGL FP', 'Font FP', 'Audio FP', 'Speech Voices FP',
      'Screen Refresh Rate (measured)',
      'Session Pages', 'Session Duration (s)', 'New Session',
      'Cameras', 'Microphones', 'Speakers',
      'Page', 'Method', 'Status', 'Response (ms)',
      'Referer', 'User Agent',
    ];

    const escCSV = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    let csv = headers.map(h => escCSV(h)).join(',') + '\n';

    logs.forEach((l) => {
      const row = [
        new Date(l.timestamp).toLocaleString('he-IL'),
        l.ipAddress,
        l.location?.country || '', l.location?.countryCode || '', l.location?.city || '', l.location?.region || '',
        l.location?.zip || '', l.location?.latitude || '', l.location?.longitude || '',
        l.location?.isp || '', l.location?.asn || '', l.location?.org || '',
        ynCSV(l.location?.isProxy), ynCSV(l.location?.isMobile), ynCSV(l.location?.isHosting),
        l.browser?.name || '', l.browser?.version || '',
        l.os?.name || '', l.os?.version || '', l.device || '', l.platform || '', l.os?.architecture || '',
        l.screen?.width || '', l.screen?.height || '', l.screen?.availWidth || '', l.screen?.availHeight || '',
        l.screen?.colorDepth || '', l.screen?.pixelRatio || '', ynCSV(l.screen?.isRetina),
        l.screen?.refreshRate || '', l.screen?.orientation || '',
        l.processor?.cores || l.hardwareConcurrency || '', l.deviceMemory || '',
        l.gpu?.vendor || '', l.gpu?.renderer || '', l.processor?.maxTouchPoints ?? '',
        l.battery?.level != null ? l.battery.level : '', ynCSV(l.battery?.charging),
        l.battery?.chargingTime ?? '', l.battery?.dischargingTime ?? '',
        l.connection?.effectiveType || '', l.connection?.rtt ?? '', l.connection?.downlink ?? '', ynCSV(l.connection?.saveData),
        (l.localIPs || []).join('; '),
        ynCSV(l.cookies?.enabled), l.cookies?.count ?? '', ynCSV(l.localStorage?.enabled),
        l.storageQuota?.quotaMB ?? '', l.storageQuota?.usedMB ?? '', ynCSV(l.privateMode),
        l.userLanguage || '', (l.languages || []).join('; '), l.timezone || '', l.keyboardLayout || '',
        ynCSV(l.prefersDarkMode), ynCSV(l.prefersHighContrast), ynCSV(l.isTouchDevice), ynCSV(l.doNotTrack),
        ynCSV(l.prefersReducedMotion), ynCSV(l.isOnline),
        ynCSV(l.adBlocker), ynCSV(l.webdriver),
        (l.automationIndicators || []).join('; '), ynCSV(l.devToolsOpen),
        (l.vmIndicators || []).join('; '),
        ynCSV(l.pdfViewerEnabled), l.pluginsCount ?? '', ynCSV(l.hasGamepad),
        ynCSV(l.webGLSupported), ynCSV(l.webGL2Supported), ynCSV(l.serviceWorkerSupported),
        ynCSV(l.indexedDBSupported), ynCSV(l.webAssemblySupported),
        ynCSV(l.sharedArrayBufferSupported), ynCSV(l.bigIntSupported),
        l.notificationPermission || '', (l.cryptoCapabilities || []).join('; '),
        l.fingerprint || '', l.canvasFingerprint || '', l.webglFingerprint || '',
        l.fontFingerprint || '', l.audioFingerprint || '', l.speechVoicesFingerprint || '',
        l.screenRefreshRate ?? '',
        l.session?.pageViews ?? '', l.session?.durationSeconds ?? '', ynCSV(l.session?.isNewSession),
        l.mediaDevices?.cameras ?? '', l.mediaDevices?.microphones ?? '', l.mediaDevices?.speakers ?? '',
        l.page || '', l.method || '', l.statusCode || '', l.responseTime || '',
        l.referer || '', l.userAgent || '',
      ];
      csv += row.map(v => escCSV(v)).join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `visitor_logs_${new Date().toISOString().split('T')[0]}.csv` }).click();
    URL.revokeObjectURL(url);
    toast.success(`CSV יורד — ${logs.length} רשומות · ${headers.length} עמודות`);
  };

  const handleDeleteOld = async () => {
    if (!confirm('למחוק לוגים ישנים מ-30 יום?')) return;
    try {
      const res = await api.delete('/logs/admin/cleanup', { data: { days: 30 } });
      toast.success(res.data.message || 'הלוגים נמחקו');
      fetchLogs();
    } catch (err) {
      toast.error(`שגיאה: ${err.response?.data?.message || err.message || 'שגיאה'}`);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ הודעה חשובה!\n\nהפעולה הזו תמחק את כל הלוגים במערכת — הפעולה בלתי הפיכה!\n\nהאם אתה בטוח?')) return;
    if (!confirm('🚨 אתה בטוח לגמרי? לא ניתן לשחזר לוגים שנמחקו!')) return;
    try {
      setLoading(true);
      const res = await api.delete('/logs/admin/delete-all');
      toast.success(`✅ נמחקו ${res.data.deletedCount} לוגים בהצלחה`);
      setLogs([]);
    } catch (err) {
      toast.error(`שגיאה: ${err.response?.data?.message || err.message || 'שגיאה'}`);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────
  if (!statusLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mb-3" />
          <p className="text-slate-500 text-sm">טוען סטטוס מעקב...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans" dir="rtl">
      <div className="max-w-[1500px] mx-auto p-4 md:p-6 lg:p-8">

        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 shadow-lg shadow-blue-500/10">
                <Activity size={24} className="text-blue-400" />
              </div>
              מעקב מבקרים
              <span className="text-sm font-normal text-slate-500 hidden md:inline">Visitor Intelligence</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">ניטור מתקדם ואיסוף מודיעין על מבקרי המערכת</p>
            <Link
              to="/admin/user-activity"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-400 hover:text-blue-300 transition font-medium"
            >
              <Users size={14} /> סיכום פעילות לפי משתמש →
            </Link>
          </div>

          <button
            onClick={handleToggleLogging}
            disabled={togglingLogging}
            className={`group relative flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-60
              ${loggingEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-2 border-emerald-500/40 hover:bg-emerald-500/25 shadow-[0_0_20px_rgba(52,211,153,0.15)]'
                : 'bg-slate-800 text-slate-400 border-2 border-slate-600/40 hover:bg-slate-700 hover:text-slate-300'
              }`}
          >
            <div className={`relative w-3 h-3 rounded-full transition-all ${loggingEnabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`}>
              {loggingEnabled && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />}
            </div>
            <Power size={16} />
            {togglingLogging ? 'מעדכן...' : loggingEnabled ? 'מעקב פעיל — לוגים נשמרים' : 'מעקב כבוי — לא נשמר כלום'}
          </button>
        </div>

        {/* ═══ OFF STATE ═══ */}
        {!loggingEnabled && (
          <div className="mt-16 text-center">
            <div className="inline-flex p-6 rounded-full bg-slate-800 border border-slate-700 mb-6">
              <EyeOff size={48} className="text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-400 mb-2">המעקב כבוי</h2>
            <p className="text-slate-600 max-w-md mx-auto">
              כרגע לא נשמרים לוגים של מבקרים. לחץ על הכפתור למעלה כדי להתחיל לאסוף נתונים.
            </p>
            {logs.length > 0 && (
              <div className="mt-8">
                <p className="text-slate-500 text-sm mb-4">יש {logs.length} לוגים ישנים שנשמרו קודם</p>
                <div className="flex justify-center gap-3">
                  <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-500/25 transition">
                    <Download size={14} /> ייצוא CSV
                  </button>
                  <button onClick={handleDeleteAll} disabled={!logs.length} className="flex items-center gap-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/50 px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-600/30 transition disabled:opacity-50">
                    <Trash2 size={14} /> מחק הכל
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ON STATE ═══ */}
        {loggingEnabled && (
          <>
            {/* ★ STAT CARDS — 8 columns */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
                <StatCard icon={<Users size={18} />} color="blue" value={summary.summary?.last24Hours || 0} label="כניסות היום" />
                <StatCard icon={<Globe size={18} />} color="green" value={summary.summary?.uniqueIPsToday || 0} label="IP ייחודי היום" />
                <StatCard icon={<Activity size={18} />} color="purple" value={summary.summary?.last7Days || 0} label="כניסות בשבוע" />
                <StatCard icon={<Zap size={18} />} color="amber" value={`${summary.summary?.avgResponseTime || 0}ms`} label="ממוצע תגובה" />
                <StatCard icon={<Users size={18} />} color="cyan" value={summary.summary?.uniqueUsers || 0} label="משתמשים רשומים" />
                <StatCard icon={<Globe size={18} />} color="rose" value={summary.summary?.uniqueIPs || 0} label="IP סה״כ" />
                <StatCard icon={<Fingerprint size={18} />} color="indigo" value={computedStats?.uniqueFingerprints || 0} label="טביעות ייחודיות" subtitle="מזוהים ע״י FP" />
                <StatCard icon={<TrendingUp size={18} />} color="teal" value={`${computedStats?.dataQuality || 0}%`} label="איכות נתונים" subtitle="עם Session בלבד" />
              </div>
            )}

            {/* ★ DETECTION COUNTERS */}
            {computedStats && logs.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={16} className="text-amber-400" />
                  <span className="text-sm font-bold text-slate-300">סטטיסטיקות זיהוי — מתוך {logs.length} ביקורים</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
                  {[
                    { label: 'טביעות', val: computedStats.uniqueFingerprints, icon: <Fingerprint size={12} />, clr: 'text-indigo-300' },
                    { label: 'Canvas FP', val: computedStats.uniqueCanvasFingerprints, icon: <Hash size={12} />, clr: 'text-purple-300' },
                    { label: 'בוטים', val: computedStats.bots, icon: <Bot size={12} />, clr: 'text-orange-300' },
                    { label: 'AdBlock', val: computedStats.adBlock, icon: <Shield size={12} />, clr: 'text-red-300' },
                    { label: 'Proxy/VPN', val: computedStats.proxies, icon: <Globe size={12} />, clr: 'text-rose-300' },
                    { label: 'VM', val: computedStats.vms, icon: <Monitor size={12} />, clr: 'text-orange-300' },
                    { label: 'DevTools', val: computedStats.devtools, icon: <Zap size={12} />, clr: 'text-yellow-300' },
                    { label: 'מצב פרטי', val: computedStats.privateMode, icon: <EyeOff size={12} />, clr: 'text-slate-300' },
                    { label: 'מסך מגע', val: computedStats.touch, icon: <MousePointer size={12} />, clr: 'text-purple-300' },
                    { label: 'מצב כהה', val: computedStats.dark, icon: <Moon size={12} />, clr: 'text-slate-300' },
                    { label: 'DNT', val: computedStats.dnt, icon: <Shield size={12} />, clr: 'text-rose-300' },
                    { label: 'עם GPU', val: computedStats.withGPU, icon: <Layers size={12} />, clr: 'text-cyan-300' },
                    { label: 'עם סוללה', val: computedStats.withBattery, icon: <BatteryCharging size={12} />, clr: 'text-green-300' },
                    { label: 'עם סשן', val: computedStats.withSession, icon: <Activity size={12} />, clr: 'text-emerald-300' },
                  ].map(({ label, val, icon, clr }) => (
                    <div key={label} className="text-center bg-slate-700/30 rounded-lg py-2 px-1">
                      <div className={`${clr} flex items-center justify-center gap-1 mb-0.5`}>{icon}</div>
                      <div className="text-lg font-black text-slate-100">{val}</div>
                      <div className="text-[10px] text-slate-500 whitespace-nowrap">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ★ CHARTS — 4 columns */}
            {summary?.analytics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Globe size={16} className="text-blue-400" /> דפדפנים</h3>
                  <MiniBar items={summary.analytics.topBrowsers} color="blue" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Monitor size={16} className="text-emerald-400" /> מערכות הפעלה</h3>
                  <MiniBar items={summary.analytics.topOS} color="green" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Smartphone size={16} className="text-purple-400" /> התקנים</h3>
                  <MiniBar items={summary.analytics.topDevices} color="purple" />
                </div>
                {summary.analytics.topPages && (
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><FileText size={16} className="text-amber-400" /> דפים פופולריים</h3>
                    <MiniBar items={summary.analytics.topPages} color="amber" />
                  </div>
                )}
              </div>
            )}

            {/* ★ TOP IPs */}
            {summary?.analytics?.topIPs?.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 mb-8">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Activity size={16} className="text-amber-400" /> IP הכי פעילים (7 ימים)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {summary.analytics.topIPs.slice(0, 10).map((ip, idx) => (
                    <div key={idx} className="bg-slate-700/30 rounded-xl px-3 py-2 cursor-pointer hover:bg-slate-700/60 transition" onClick={() => setSearchIP(ip._id)}>
                      <div className="font-mono text-sm text-slate-200 font-bold">{ip._id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{ip.count} כניסות · {timeAgo(ip.lastSeen)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ★ FILTERS */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-slate-700/40 rounded-lg overflow-hidden border border-slate-600/30">
                  {['all', 'desktop', 'mobile', 'tablet'].map((d) => (
                    <button key={d} onClick={() => setFilterDevice(d)}
                      className={`px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${filterDevice === d ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'}`}>
                      {d === 'all' ? 'הכל' : <DeviceIcon type={d} size={14} />}
                      {d !== 'all' && <span className="hidden sm:inline">{d === 'desktop' ? 'מחשב' : d === 'mobile' ? 'נייד' : 'טאבלט'}</span>}
                    </button>
                  ))}
                </div>
                <div className="flex items-center bg-slate-700/40 rounded-lg border border-slate-600/30 px-3 gap-2">
                  <Search size={14} className="text-slate-500" />
                  <input type="text" value={searchIP} onChange={(e) => setSearchIP(e.target.value)} placeholder="חפש IP..." className="bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-500 py-2 w-32" />
                  {searchIP && <button onClick={() => setSearchIP('')} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>}
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-slate-700/40 border border-slate-600/30 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none">
                  <option value="newest">חדש ← ישן</option>
                  <option value="oldest">ישן ← חדש</option>
                  <option value="slowest">איטי ← מהיר</option>
                </select>
                <div className="flex-1" />
                <button onClick={fetchLogs} disabled={loading} className="flex items-center gap-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500/25 transition disabled:opacity-50">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> רענן
                </button>
                <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-500/25 transition">
                  <Download size={14} /> CSV
                </button>
                <button onClick={handleDeleteOld} className="flex items-center gap-1.5 bg-red-500/15 text-red-300 border border-red-500/30 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-500/25 transition">
                  <Trash2 size={14} /> נקה ישנים
                </button>
                <button onClick={handleDeleteAll} disabled={loading || !logs.length} className="flex items-center gap-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-rose-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed" title="מחק את כל הלוגים">
                  <Trash2 size={14} /> מחק הכל
                </button>
              </div>
            </div>

            {/* ★ LOGS TABLE */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="bg-slate-800 px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">📋 {logs.length} ביקורים</span>
                <div className="flex items-center gap-3">
                  {computedStats?.uniqueFingerprints > 0 && (
                    <span className="text-xs text-indigo-400 flex items-center gap-1"><Fingerprint size={12} /> {computedStats.uniqueFingerprints} מבקרים ייחודיים</span>
                  )}
                  {loading && <RefreshCw size={14} className="animate-spin text-blue-400" />}
                </div>
              </div>

              {loading && !logs.length ? (
                <div className="flex justify-center py-16">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-3" />
                    <p className="text-slate-500 text-sm">טוען ביקורים...</p>
                  </div>
                </div>
              ) : !logs.length ? (
                <div className="py-16 text-center">
                  <Activity size={40} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 font-medium">אין ביקורים עדיין</p>
                  <p className="text-slate-600 text-sm mt-1">ביקורים חדשים יופיעו כאן אוטומטית כל 10 שניות</p>
                </div>
              ) : (
                <div>
                  {logs.map((log, idx) => (
                    <LogRow key={log._id || idx} log={log} isExpanded={expandedLog === idx} onToggle={() => setExpandedLog(expandedLog === idx ? null : idx)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminLogsPage;
