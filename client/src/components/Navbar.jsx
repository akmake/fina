import { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Menu, X, LogOut, LayoutDashboard, Landmark,
  TrendingUp, Home, Settings, UserCircle, PieChart,
  ChevronDown, Cpu, BarChart3, Receipt,
  CreditCard, Target, Moon, Sun, Lightbulb, Activity,
  Wallet, RefreshCw, Scale, GraduationCap, FileSpreadsheet, Upload,
  Shield, Building2, Bell, Calculator, DownloadCloud, Baby, Globe, FileText, Hammer, Zap,
  Layers, Banknote, HandCoins, ClipboardList,
  Coins, PiggyBank, SlidersHorizontal, Lock,
} from "lucide-react";

import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------
const NAV_GROUPS = [
  {
    label: "פיננסים",
    icon: Coins,
    items: [
      { to: "/finance-dashboard", label: "לוח בקרה", icon: LayoutDashboard, auth: true },
      { to: "/portfolio",         label: "עסקאות",   icon: Receipt,          auth: true },
      { to: "/categories",        label: "קטגוריות", icon: Layers,           auth: true },
      { to: "/budget",            label: "תקציב",    icon: Wallet,           auth: true },
      { to: "/recurring",         label: "קבועים",   icon: RefreshCw,        auth: true },
      { to: "/smart-analytics",   label: "ניתוח חכם", icon: BarChart3,        auth: true },
      { to: "/net-worth",         label: "שווי נקי",  icon: Scale,            auth: true },
    ],
  },
  {
    label: "השקעות וחיסכון",
    icon: PiggyBank,
    items: [
      { to: "/investments", label: "מניות",    icon: TrendingUp,    auth: true },
      { to: "/deposits",    label: "פיקדונות", icon: Landmark,      auth: true },
      { to: "/funds",       label: "קרנות",    icon: BarChart3,     auth: true },
      { to: "/pension",     label: "פנסיוני",  icon: GraduationCap, auth: true },
      { to: "/foreign-currency", label: "מט\"ח", icon: Globe,       auth: true },
    ],
  },
  {
    label: "נכסים והתחייבויות",
    icon: Home,
    items: [
      { to: "/real-estate",   label: "נדל\"ן",      icon: Building2,  auth: true },
      { to: "/mortgage",      label: "משכנתא",      icon: Landmark,   auth: true },
      { to: "/my-loans",      label: "הלוואות",     icon: CreditCard, auth: true },
      { to: "/debts",         label: "ניהול חובות", icon: HandCoins,  auth: true },
      { to: "/child-savings", label: "חיסכון ילדים", icon: Baby,      auth: true },
    ],
  },
  {
    label: "תכנון",
    icon: Target,
    items: [
      { to: "/goals",          label: "יעדים",       icon: Target,        auth: true },
      { to: "/insurance",      label: "ביטוח",       icon: Shield,        auth: true },
      { to: "/tax",            label: "מחשבון מס",   icon: Calculator,    auth: true },
      { to: "/projects",       label: "פרויקטים",    icon: ClipboardList, auth: true },
      { to: "/pergola-planner",label: "מתכנן פרגולות", icon: Hammer,      auth: true },
      { to: "/electrical",     label: "שרטוט חשמל",  icon: Zap,           auth: true },
    ],
  },
  {
    label: "ניהול",
    icon: SlidersHorizontal,
    items: [
      { to: "/alerts",          label: "התראות",                icon: Bell,            auth: true },
      { to: "/reports",         label: "דוחות",                 icon: FileText,        auth: true },
      { to: "/management",      label: "אוטומציה",              icon: Cpu,             auth: true },
      { to: "/import/excel",    label: "ייבוא אקסל",            icon: FileSpreadsheet, auth: true },
      { to: "/import/auto",     label: "ייבוא אוטומטי",         icon: DownloadCloud,   auth: true },
      { to: "/import",          label: "ייבוא נתונים",          icon: Upload,          auth: true },
      { to: "/discount-import", label: "ייבוא הכנסות (דיסקונט)", icon: Banknote,       auth: true },
      { to: "/suggestions",     label: "הצעות שיפור",           icon: Lightbulb,       auth: true },
    ],
  },
  {
    label: "אדמין",
    icon: Lock,
    items: [
      { to: "/admin/logs", label: "דוח מבקרים", icon: Activity, auth: true, adminOnly: true },
    ],
  },
];

// Bottom tabs shown on mobile (most used)
const BOTTOM_TABS = [
  { to: "/finance-dashboard", label: "בקרה",    icon: LayoutDashboard },
  { to: "/portfolio",         label: "עסקאות",  icon: Receipt },
  { to: "/budget",            label: "תקציב",   icon: Wallet },
  { to: "/investments",       label: "השקעות",  icon: TrendingUp },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getVisibleGroups = (isAuthenticated, userRole) =>
  NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.auth && !isAuthenticated) return false;
      if (item.adminOnly && userRole !== "admin") return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name[0].toUpperCase();
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Navbar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const visibleGroups = getVisibleGroups(isAuthenticated, user?.role);
  const location = useLocation();

  // Close "more" panel on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when "more" panel is open
  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [moreOpen]);

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent
          groups={visibleGroups}
          user={user}
          isAuthenticated={isAuthenticated}
          logout={logout}
        />
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-stretch h-16 safe-area-pb">
        {BOTTOM_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.to || location.pathname.startsWith(tab.to + "/");
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} strokeWidth={isActive ? 2.5 : 1.8} />
              {tab.label}
            </Link>
          );
        })}

        {/* "More" button */}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            moreOpen ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
          }`}
        >
          <Menu className="h-5 w-5" strokeWidth={1.8} />
          עוד
        </button>
      </nav>

      {/* ── Mobile top bar (brand + user) ───────────────────────── */}
      <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-14 px-4 fixed top-0 left-0 right-0 z-30">
        <Link
          to="/"
          className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
        >
          Fina
        </Link>
        {isAuthenticated && (
          <MobileUserMenu user={user} logout={logout} />
        )}
      </div>

      {/* ── Mobile "more" full-screen overlay ───────────────────── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          {/* Panel slides up from bottom */}
          <div
            className="md:hidden fixed left-0 right-0 bottom-16 z-50 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "75vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Scrollable nav list */}
            <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(75vh - 48px)" }}>
              {visibleGroups.map((group, gi) => {
                const GroupIcon = group.icon;
                return (
                  <div key={gi}>
                    <div className="flex items-center gap-2 px-5 pt-4 pb-1.5">
                      <GroupIcon className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {group.label}
                      </span>
                    </div>
                    <div className="px-3 pb-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                                : "text-slate-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800"
                            }`}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="h-6" />
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Mobile user menu (top bar avatar)
// ---------------------------------------------------------------------------
function MobileUserMenu({ user, logout }) {
  const { isDark, toggleDark } = useUIStore();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleDark}
        className="h-9 w-9 text-slate-500"
        aria-label={isDark ? "מצב בהיר" : "מצב כהה"}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {getInitials(user?.name)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 z-[60]" side="bottom" align="end">
          <DropdownMenuLabel className="font-normal">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile"><UserCircle className="me-2 h-4 w-4" />פרופיל</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings"><Settings className="me-2 h-4 w-4" />הגדרות</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer">
            <LogOut className="me-2 h-4 w-4" />
            התנתק
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop Sidebar content
// ---------------------------------------------------------------------------
function SidebarContent({ groups, user, isAuthenticated, logout, onClose }) {
  const { isDark, toggleDark } = useUIStore();
  const location = useLocation();

  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {};
    let hasActive = false;
    groups.forEach((group) => {
      const isActiveGroup = group.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      );
      if (isActiveGroup) {
        initial[group.label] = true;
        hasActive = true;
      }
    });
    if (!hasActive && groups.length > 0) initial[groups[0].label] = true;
    return initial;
  });

  const toggleGroup = (label) =>
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleLogout = () => {
    logout();
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Brand */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
        <Link
          to="/"
          onClick={onClose}
          className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
        >
          Fina
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            aria-label={isDark ? "עבור למצב בהיר" : "עבור למצב כהה"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="סגור תפריט">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {groups.map((group, gi) => {
          const isExpanded = expandedGroups[group.label];
          return (
            <div key={gi}>
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 mt-1 rounded-lg transition-colors cursor-pointer
                    ${isExpanded
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {group.icon && <group.icon className="h-4 w-4 flex-shrink-0" />}
                    <span className="text-sm font-bold">{group.label}</span>
                  </div>
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform duration-200"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
              )}
              {isExpanded && (
                <ul className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavItem item={item} onClick={onClose} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Privacy */}
      <div className="px-4 pb-2">
        <Link
          to="/privacy"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          מדיניות פרטיות ותנאי שימוש
        </Link>
      </div>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
        {isAuthenticated ? (
          <UserNav user={user} logout={handleLogout} onClose={onClose} />
        ) : (
          <div className="space-y-2">
            <Button variant="ghost" asChild className="w-full justify-start">
              <Link to="/login" onClick={onClose}>
                <UserCircle className="me-2 h-4 w-4" />
                התחברות
              </Link>
            </Button>
            <Button asChild className="w-full">
              <Link to="/register" onClick={onClose}>הרשמה</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop nav item
// ---------------------------------------------------------------------------
function NavItem({ item, onClick }) {
  const base = "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150";
  const active = "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-r-2 border-blue-500 dark:border-blue-400";
  const inactive = "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 border-r-2 border-transparent";

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onClick}
      className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
    >
      <item.icon className="flex-shrink-0 h-4 w-4" />
      <span>{item.label}</span>
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Desktop user nav (bottom of sidebar)
// ---------------------------------------------------------------------------
function UserNav({ user, logout, onClose }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-start">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {user?.name || "משתמש"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 z-[60]" side="top" align="start" sideOffset={4}>
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" onClick={onClose}><UserCircle className="me-2 h-4 w-4" />פרופיל</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" onClick={onClose}><Settings className="me-2 h-4 w-4" />הגדרות</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40 cursor-pointer">
          <LogOut className="me-2 h-4 w-4" />
          התנתק
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
