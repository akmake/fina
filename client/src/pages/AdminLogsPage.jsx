import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, RefreshCw, Download, Trash2, Clock, Users, Globe, Monitor,
  Smartphone, Tablet, Activity, Eye, Filter, ChevronLeft, ChevronRight,
  Wifi, Zap, Languages, ExternalLink, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area,
} from "recharts";
import api from "@/utils/api";

// ── Colors ─────────────────────────────────────────
const COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316",
];

const DEVICE_ICONS = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: Globe,
};

// ── Main Page ─────────────────────────────────────
export default function AdminLogsPage() {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    device: "",
    method: "",
    browser: "",
    ipAddress: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // ── Fetch Summary ──
  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/logs/admin/summary");
      setSummary(data);
    } catch (err) {
      console.error("Failed to load summary", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch Logs ──
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const params = { limit, skip: page * limit };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.device) params.device = filters.device;
      if (filters.method) params.method = filters.method;
      if (filters.browser) params.browser = filters.browser;
      if (filters.ipAddress) params.ipAddress = filters.ipAddress;

      const { data } = await api.get("/logs/admin/all", { params });
      setLogs(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLogsLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { if (tab === "logs") fetchLogs(); }, [tab, fetchLogs]);

  // ── Cleanup ──
  const handleCleanup = async (days) => {
    if (!confirm(`האם למחוק לוגים ישנים מלפני ${days} ימים?`)) return;
    try {
      const { data } = await api.delete("/logs/admin/cleanup", { params: { days } });
      alert(data.message);
      fetchSummary();
      if (tab === "logs") fetchLogs();
    } catch (err) {
      alert("שגיאה במחיקה");
    }
  };

  // ── Export CSV ──
  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ["IP", "דפדפן", "מערכת הפעלה", "מכשיר", "דף", "Method", "סטטוס", "זמן תגובה (ms)", "תאריך"];
    const rows = logs.map((l) => [
      l.ipAddress,
      `${l.browser?.name || ""} ${l.browser?.version || ""}`,
      `${l.os?.name || ""} ${l.os?.version || ""}`,
      l.device?.type || "",
      l.page,
      l.method,
      l.statusCode,
      l.responseTime,
      new Date(l.timestamp).toLocaleString("he-IL"),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `visitor-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-500" />
            דוח מבקרים ואנליטיקס
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            מעקב אחר כל התנועה באתר — דפדפנים, מכשירים, זמני תגובה ועוד
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchSummary(); if (tab === "logs") fetchLogs(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/60 transition"
          >
            <RefreshCw className="h-4 w-4" /> רענון
          </button>
          <button
            onClick={() => handleCleanup(90)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/60 transition"
          >
            <Trash2 className="h-4 w-4" /> ניקוי ישנים
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {[
          { key: "overview", label: "📈 סקירה כללית" },
          { key: "logs", label: "📋 לוגים מפורטים" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
              tab === t.key
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "overview" ? (
        <OverviewTab summary={summary} loading={loading} />
      ) : (
        <LogsTab
          logs={logs}
          total={total}
          page={page}
          setPage={setPage}
          limit={limit}
          setLimit={setLimit}
          filters={filters}
          setFilters={setFilters}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          loading={logsLoading}
          exportCSV={exportCSV}
          fetchLogs={fetchLogs}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════
function OverviewTab({ summary, loading }) {
  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const { summary: s, analytics: a } = summary;

  const statCards = [
    { label: "סה\"כ לוגים", value: s.totalLogs.toLocaleString(), icon: Activity, color: "blue" },
    { label: "24 שעות אחרונות", value: s.last24Hours.toLocaleString(), icon: Clock, color: "green" },
    { label: "7 ימים אחרונים", value: s.last7Days.toLocaleString(), icon: TrendingUp, color: "purple" },
    { label: "30 ימים אחרונים", value: s.last30Days.toLocaleString(), icon: Eye, color: "orange" },
    { label: "IP ייחודיים", value: s.uniqueIPs.toLocaleString(), icon: Globe, color: "cyan" },
    { label: "משתמשים ייחודיים", value: s.uniqueUsers.toLocaleString(), icon: Users, color: "pink" },
    { label: "זמן תגובה ממוצע", value: `${s.avgResponseTime}ms`, icon: Zap, color: "yellow" },
  ];

  const colorMap = {
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400",
    cyan: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400",
    pink: "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400",
    yellow: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400",
  };

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${colorMap[card.color]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 — Browsers + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="דפדפנים מובילים">
          {a.topBrowsers?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={a.topBrowsers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="התפלגות מכשירים">
          {a.topDevices?.length > 0 ? (
            <div className="flex items-center justify-center gap-8">
              <ResponsiveContainer width="60%" height={280}>
                <PieChart>
                  <Pie data={a.topDevices} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {a.topDevices.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {a.topDevices.map((d, i) => {
                  const DevIcon = DEVICE_ICONS[d.name] || Globe;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <DevIcon className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-700 dark:text-slate-300">{d.name}</span>
                      <span className="text-slate-400">({d.count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Charts Row 2 — OS + Daily Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="מערכות הפעלה מובילות">
          {a.topOS?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={a.topOS} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="פעילות יומית (30 ימים אחרונים)">
          {a.dailyDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={a.dailyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f680" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Charts Row 3 — Hourly + Status Codes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="התפלגות שעתית (24 שעות)">
          {a.hourlyDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={a.hourlyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="קודי סטטוס">
          {a.statusCodes?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={a.statusCodes.map(s => ({ ...s, name: String(s.code) }))} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {a.statusCodes.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Charts Row 4 — Top Pages + Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="דפים הנצפים ביותר">
          {a.topPages?.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {a.topPages.map((p, i) => {
                const maxCount = a.topPages[0]?.count || 1;
                const pct = Math.round((p.count / maxCount) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-6 text-left">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate" title={p.name}>
                          {p.name}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">{p.count}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="HTTP Methods + שפות + Referrers">
          <div className="space-y-4">
            {/* Methods */}
            {a.methodDistribution?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Methods</p>
                <div className="flex flex-wrap gap-2">
                  {a.methodDistribution.map((m, i) => (
                    <span key={i} className={`px-3 py-1 text-xs font-medium rounded-full ${getMethodColor(m.method)}`}>
                      {m.method}: {m.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Languages */}
            {a.topLanguages?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                  <Languages className="h-3 w-3" /> שפות
                </p>
                <div className="flex flex-wrap gap-2">
                  {a.topLanguages.slice(0, 6).map((l, i) => (
                    <span key={i} className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">
                      {l.language}: {l.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Referrers */}
            {a.topReferrers?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Referrers
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {a.topReferrers.map((r, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span className="truncate flex-1">{r.referrer}</span>
                      <span className="text-slate-400 mr-2">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Logs Tab
// ═══════════════════════════════════════════════════
function LogsTab({
  logs, total, page, setPage, limit, setLimit,
  filters, setFilters, showFilters, setShowFilters,
  loading, exportCSV, fetchLogs,
}) {
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition ${
              showFilters
                ? "bg-blue-100 dark:bg-blue-950/50 text-blue-600"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            <Filter className="h-4 w-4" /> סינון
          </button>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(0); }}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{total.toLocaleString()} תוצאות</span>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 transition"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <FilterInput label="מתאריך" type="date" value={filters.startDate} onChange={(v) => setFilters({ ...filters, startDate: v })} />
          <FilterInput label="עד תאריך" type="date" value={filters.endDate} onChange={(v) => setFilters({ ...filters, endDate: v })} />
          <FilterSelect label="מכשיר" value={filters.device} onChange={(v) => setFilters({ ...filters, device: v })}
            options={[{ value: "", label: "הכל" }, { value: "desktop", label: "Desktop" }, { value: "mobile", label: "Mobile" }, { value: "tablet", label: "Tablet" }]}
          />
          <FilterSelect label="Method" value={filters.method} onChange={(v) => setFilters({ ...filters, method: v })}
            options={[{ value: "", label: "הכל" }, { value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }, { value: "DELETE", label: "DELETE" }]}
          />
          <FilterInput label="דפדפן" type="text" value={filters.browser} onChange={(v) => setFilters({ ...filters, browser: v })} placeholder="Chrome..." />
          <FilterInput label="IP" type="text" value={filters.ipAddress} onChange={(v) => setFilters({ ...filters, ipAddress: v })} placeholder="192.168..." />
          <div className="col-span-full flex justify-end gap-2 mt-1">
            <button
              onClick={() => { setFilters({ startDate: "", endDate: "", device: "", method: "", browser: "", ipAddress: "" }); setPage(0); }}
              className="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 transition"
            >
              איפוס
            </button>
            <button
              onClick={() => { setPage(0); fetchLogs(); }}
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              חפש
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              {["IP", "דפדפן", "מערכת", "מכשיר", "דף", "Method", "סטטוס", "זמן (ms)", "שפה", "תאריך"].map((h) => (
                <th key={h} className="px-3 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12 text-slate-400"><RefreshCw className="h-6 w-6 mx-auto animate-spin" /></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-slate-400">אין לוגים להצגה</td></tr>
            ) : (
              logs.map((log, i) => (
                <tr key={log._id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{log.ipAddress}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{log.browser?.name} {log.browser?.version?.split('.')[0]}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{log.os?.name} {log.os?.version}</td>
                  <td className="px-3 py-2.5">
                    <DeviceBadge type={log.device?.type} />
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-[200px] truncate" title={log.page}>{log.page}</td>
                  <td className="px-3 py-2.5"><MethodBadge method={log.method} /></td>
                  <td className="px-3 py-2.5"><StatusBadge code={log.statusCode} /></td>
                  <td className="px-3 py-2.5 text-xs font-mono">
                    <span className={log.responseTime > 500 ? "text-red-500" : log.responseTime > 200 ? "text-yellow-500" : "text-green-500"}>
                      {log.responseTime}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{log.language || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            עמוד {page + 1} מתוך {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Small reusable components
// ═══════════════════════════════════════════════════

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <p className="text-center text-sm text-slate-400 py-10">אין נתונים עדיין</p>;
}

function StatusBadge({ code }) {
  let cls = "bg-slate-100 text-slate-600";
  if (code >= 200 && code < 300) cls = "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400";
  else if (code >= 300 && code < 400) cls = "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400";
  else if (code >= 400 && code < 500) cls = "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400";
  else if (code >= 500) cls = "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400";
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{code}</span>;
}

function MethodBadge({ method }) {
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getMethodColor(method)}`}>{method}</span>;
}

function DeviceBadge({ type }) {
  const Icon = DEVICE_ICONS[type] || Globe;
  const labels = { desktop: "מחשב", mobile: "נייד", tablet: "טאבלט", unknown: "לא ידוע" };
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
      <Icon className="h-3.5 w-3.5" />
      {labels[type] || type}
    </span>
  );
}

function FilterInput({ label, type, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
      />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function getMethodColor(method) {
  const map = {
    GET: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    POST: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
    PUT: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400",
    DELETE: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    PATCH: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400",
  };
  return map[method] || "bg-slate-100 text-slate-600";
}
