import { useState, Fragment, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Menu, X, LogOut, LayoutDashboard, Landmark,
  TrendingUp, Home, Settings, UserCircle, PieChart,
  ChevronDown, Cpu, BarChart3, Receipt,
  CreditCard, Target, Moon, Sun, Lightbulb, Activity,
  Wallet, RefreshCw, Scale, GraduationCap, FileSpreadsheet, Upload,
  Shield, Building2, Bell, Calculator, DownloadCloud, Baby, Globe, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
// Navigation structure — grouped for clarity
// ---------------------------------------------------------------------------
const NAV_GROUPS = [
  {
    label: "פיננסים",
    items: [
      { to: "/finance-dashboard", label: "לוח בקרה", icon: LayoutDashboard, auth: true },
      { to: "/portfolio",         label: "עסקאות",   icon: Receipt,          auth: true },
      { to: "/categories",        label: "קטגוריות", icon: PieChart,         auth: true },
      { to: "/budget",            label: "תקציב",    icon: Wallet,           auth: true },
      { to: "/recurring",         label: "קבועים",   icon: RefreshCw,        auth: true },
      { to: "/smart-analytics",   label: "ניתוח חכם", icon: BarChart3,        auth: true },
      { to: "/net-worth",         label: "שווי נקי",  icon: Scale,            auth: true },
    ],
  },
  {
    label: "השקעות וחיסכון",
    items: [
      { to: "/investments", label: "מניות",    icon: TrendingUp,    auth: true },
      { to: "/deposits",    label: "פיקדונות", icon: Landmark,      auth: true },
      { to: "/funds",       label: "קרנות",    icon: PieChart,      auth: true },
      { to: "/pension",     label: "פנסיוני",  icon: GraduationCap, auth: true },
      { to: "/foreign-currency", label: "מט\"ח", icon: Globe,       auth: true },
    ],
  },
  {
    label: "נכסים והתחייבויות",
    items: [
      { to: "/real-estate",   label: "נדל\"ן",      icon: Building2,  auth: true },
      { to: "/mortgage",      label: "משכנתא",      icon: Building2,  auth: true },
      { to: "/my-loans",      label: "הלוואות",     icon: CreditCard, auth: true },
      { to: "/debts",         label: "ניהול חובות", icon: CreditCard, auth: true },
      { to: "/child-savings", label: "חיסכון ילדים", icon: Baby,      auth: true },
    ],
  },
  {
    label: "תכנון",
    items: [
      { to: "/goals",    label: "יעדים",    icon: Target,     auth: true },
      { to: "/insurance", label: "ביטוח",   icon: Shield,     auth: true },
      { to: "/tax",       label: "מחשבון מס", icon: Calculator, auth: true },
      { to: "/projects",  label: "פרויקטים", icon: Target,     auth: true },
    ],
  },
  {
    label: "ניהול",
    items: [
      { to: "/alerts",         label: "התראות",                icon: Bell,            auth: true },
      { to: "/reports",        label: "דוחות",                 icon: FileText,        auth: true },
      { to: "/management",     label: "אוטומציה",              icon: Cpu,             auth: true },
      { to: "/import/excel",   label: "ייבוא אקסל",            icon: FileSpreadsheet, auth: true },
      { to: "/import",         label: "ייבוא נתונים",          icon: Upload,          auth: true },
      { to: "/discount-import",label: "ייבוא הכנסות (דיסקונט)", icon: DownloadCloud,   auth: true },
      { to: "/suggestions",    label: "הצעות שיפור",           icon: Lightbulb,       auth: true },
    ],
  },
  {
    label: "אדמין",
    items: [
      { to: "/admin/logs", label: "דוח מבקרים", icon: Activity, auth: true, adminOnly: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getVisibleGroups = (isAuthenticated, userRole) =>
  NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.auth && !isAuthenticated) return false;
      if (item.adminOnly && userRole !== 'admin') return false;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const visibleGroups = getVisibleGroups(isAuthenticated, user?.role);

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent
          groups={visibleGroups}
          user={user}
          isAuthenticated={isAuthenticated}
          logout={logout}
        />
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-16 px-4 fixed top-0 left-0 right-0 z-30">
        <Link
          to="/"
          className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
        >
          Fina
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="פתח תפריט">
          <Menu className="h-6 w-6" aria-hidden="true" />
        </Button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <Fragment>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-50 w-[280px] max-w-[85vw] md:hidden"
            >
              <SidebarContent
                groups={visibleGroups}
                user={user}
                isAuthenticated={isAuthenticated}
                logout={logout}
                onClose={() => setSidebarOpen(false)}
              />
            </motion.div>
          </Fragment>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar content (shared between desktop + mobile)
// ---------------------------------------------------------------------------
function SidebarContent({ groups, user, isAuthenticated, logout, onClose }) {
  const { isDark, toggleDark } = useUIStore();
  const location = useLocation();

  // State to track which accordions are open
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {};
    groups.forEach((group, index) => {
      // Auto-expand the group if the current URL matches one of its items
      const isActiveGroup = group.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      );
      // Open the active group, or the first group by default
      if (isActiveGroup || index === 0) {
        initial[group.label] = true;
      }
    });
    return initial;
  });

  const toggleGroup = (label) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => {
    logout();
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Brand header */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <Link
          to="/"
          onClick={onClose}
          className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
        >
          Fina
        </Link>
        <div className="flex items-center gap-1">
          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            aria-label={isDark ? "עבור למצב בהיר" : "עבור למצב כהה"}
          >
            {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="סגור תפריט">
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation - With Accordions */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {groups.map((group, gi) => {
          const isExpanded = expandedGroups[group.label];

          return (
            <div key={gi} className="mb-1">
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <span>{group.label}</span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.div>
                </button>
              )}
              <AnimatePresence initial={false}>
                {(!group.label || isExpanded) && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="space-y-0.5 overflow-hidden mt-1"
                  >
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <NavItem item={item} onClick={onClose} />
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Privacy link */}
      <div className="px-4 pb-2">
        <Link
          to="/privacy"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          מדיניות פרטיות ותנאי שימוש
        </Link>
      </div>

      {/* Footer — user section */}
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
// Single nav item
// ---------------------------------------------------------------------------
function NavItem({ item, onClick }) {
  const base =
    "group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150";
  const active =
    "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400";
  const inactive =
    "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100";

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
// User nav (bottom of sidebar)
// ---------------------------------------------------------------------------
function UserNav({ user, logout, onClose }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-start">
          {/* Avatar */}
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {user?.name || "משתמש"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" side="top" align="start" sideOffset={4}>
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" onClick={onClose}>
            <UserCircle className="me-2 h-4 w-4" />
            פרופיל
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" onClick={onClose}>
            <Settings className="me-2 h-4 w-4" />
            הגדרות
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40 cursor-pointer"
        >
          <LogOut className="me-2 h-4 w-4" />
          התנתק
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}