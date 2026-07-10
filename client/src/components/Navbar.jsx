import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Landmark, TrendingUp, Home, Settings, UserCircle,
  ChevronDown, Cpu, BarChart3, Receipt, CreditCard, Target, Moon, Sun,
  Wallet, RefreshCw, Scale, GraduationCap, FileSpreadsheet, Upload,
  Shield, Building2, Bell, Calculator, DownloadCloud, Baby, Globe,
  FileText, Layers, Banknote, HandCoins, ClipboardList, Store,
  Coins, PiggyBank, SlidersHorizontal, Lock, LogOut, Activity,
  Lightbulb, X, Search, Users, HelpCircle, Briefcase,
} from "lucide-react";

import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "פיננסים", icon: Coins,
    items: [
      { to: "/finance-dashboard", label: "לוח בקרה",  icon: LayoutDashboard },
      { to: "/portfolio",  label: "עסקאות",   icon: Receipt   },
      { to: "/categories", label: "קטגוריות", icon: Layers    },
      { to: "/budget",     label: "תקציב",    icon: Wallet    },
      { to: "/recurring",  label: "קבועים",   icon: RefreshCw },
      { to: "/merchants",  label: "בתי עסק",  icon: Store     },
    ],
  },
  {
    label: "השקעות וחיסכון", icon: PiggyBank,
    items: [
      { to: "/assets",           label: "תיק נכסים", icon: PiggyBank     },
      { to: "/investments",      label: "מניות",    icon: TrendingUp    },
      { to: "/deposits",         label: "פיקדונות", icon: Landmark      },
      { to: "/funds",            label: "קרנות",    icon: BarChart3     },
      { to: "/pension",          label: "פנסיוני",  icon: GraduationCap },
      { to: "/foreign-currency", label: 'מט"ח',    icon: Globe         },
    ],
  },
  {
    label: "נכסים", icon: Home,
    items: [
      { to: "/real-estate",   label: 'נדל"ן',       icon: Building2  },
      { to: "/mortgage",      label: "משכנתא",       icon: Landmark   },
      { to: "/my-loans",      label: "הלוואות",      icon: CreditCard },
      { to: "/debts",         label: "חובות",        icon: HandCoins  },
      { to: "/child-savings", label: "חיסכון ילדים", icon: Baby       },
    ],
  },
  {
    label: "תכנון", icon: Target,
    items: [
      { to: "/business",  label: "הוצאות עסקיות", icon: Briefcase    },
      { to: "/goals",     label: "יעדים",          icon: Target        },
      { to: "/maaser",    label: "מעשרות",         icon: HandCoins     },
      { to: "/family",    label: "אזור משפחתי",    icon: Users         },
      { to: "/insurance", label: "ביטוח",          icon: Shield        },
      { to: "/tax",       label: "מחשבון מס",      icon: Calculator    },
      { to: "/projects",  label: "פרויקטים",       icon: ClipboardList },
    ],
  },
  {
    label: "ניהול", icon: SlidersHorizontal,
    items: [
      { to: "/help",            label: "מדריך שימוש",    icon: HelpCircle      },
      { to: "/management",      label: "אוטומציה",       icon: Cpu             },
      { to: "/connections",     label: "חיבורים וייבוא", icon: DownloadCloud   },
      { to: "/suggestions",     label: "הצעות שיפור",    icon: Lightbulb       },
    ],
  },
  {
    label: "אדמין", icon: Lock, adminOnly: true,
    items: [
      { to: "/admin/logs",  label: "דוח מבקרים", icon: Activity, adminOnly: true },
      { to: "/admin/users", label: "משתמשים",    icon: Users,    adminOnly: true },
    ],
  },
];

const BOTTOM_TABS = [
  { to: "/finance-dashboard", label: "בקרה",   icon: LayoutDashboard },
  { to: "/portfolio",         label: "עסקאות", icon: Receipt         },
  { to: "/budget",            label: "תקציב",  icon: Wallet          },
  { to: "/investments",       label: "השקעות", icon: TrendingUp      },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const getVisibleGroups = (isAuth, role) =>
  NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => !i.adminOnly || role === "admin") }))
    .filter(g => (!g.adminOnly || role === "admin") && (!g.items.length === false));

const initials = (name) => {
  if (!name) return "U";
  const p = name.trim().split(" ");
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : name[0]).toUpperCase();
};

const isPathActive = (to, pathname) =>
  pathname === to || (to !== "/" && pathname.startsWith(to + "/"));

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
export default function Navbar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const groups = getVisibleGroups(isAuthenticated, user?.role);
  const location = useLocation();

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [moreOpen]);

  return (
    <>
      {/* ════════════════ DESKTOP SIDEBAR ════════════════ */}
      <div className="hidden md:flex md:w-20 md:flex-col md:fixed md:inset-y-0 md:z-40">
        <DesktopSidebar groups={groups} user={user} isAuthenticated={isAuthenticated} logout={logout} />
      </div>

      {/* ════════════════ MOBILE ════════════════ */}
      <MobileTopBar user={user} isAuthenticated={isAuthenticated} logout={logout} />
      <MobileBottomBar
        tabs={BOTTOM_TABS}
        moreOpen={moreOpen}
        onMoreOpen={() => setMoreOpen(true)}
        pathname={location.pathname}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        groups={groups}
        user={user}
        logout={logout}
        pathname={location.pathname}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile — Top Bar
// ─────────────────────────────────────────────────────────────
function MobileTopBar({ user, isAuthenticated, logout }) {
  const { isDark, toggleDark } = useUIStore();

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14
      bg-white/75 dark:bg-[#0f1117]/80
      backdrop-blur-2xl
      border-b border-black/[0.06] dark:border-white/[0.06]">
      <div className="h-full px-4 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black tracking-tight">F</span>
          </div>
          <span className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white">
            fina
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleDark}
            className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            {isDark
              ? <Sun className="h-[17px] w-[17px]" strokeWidth={1.8} />
              : <Moon className="h-[17px] w-[17px]" strokeWidth={1.8} />}
          </button>

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[12px] font-bold shadow ring-2 ring-white dark:ring-slate-900">
                  {initials(user?.name)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52 z-[60] rounded-2xl p-1 shadow-xl border-0 bg-white dark:bg-slate-900" side="bottom" align="end" sideOffset={6}>
                <div className="px-3 py-2.5 mb-1">
                  <p className="font-semibold text-[13px] text-slate-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 mb-1" />
                <DropdownMenuItem asChild className="rounded-xl">
                  <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm">
                    <UserCircle className="h-4 w-4 text-slate-400" /> פרופיל
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl">
                  <Link to="/settings" className="flex items-center gap-2.5 px-3 py-2 text-sm">
                    <Settings className="h-4 w-4 text-slate-400" /> הגדרות
                  </Link>
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 my-1" />
                <DropdownMenuItem
                  onClick={logout}
                  className="rounded-xl text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer"
                >
                  <LogOut className="h-4 w-4" /> התנתק
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile — Bottom Tab Bar
// ─────────────────────────────────────────────────────────────
function MobileBottomBar({ tabs, moreOpen, onMoreOpen, pathname }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30
        bg-white/80 dark:bg-[#0f1117]/85
        backdrop-blur-2xl
        border-t border-black/[0.06] dark:border-white/[0.06]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-[56px]">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = isPathActive(to, pathname);
          return (
            <Link key={to} to={to} className="flex-1 flex flex-col items-center justify-center gap-[3px] relative group">
              {/* Active pill */}
              {active && (
                <span className="absolute top-2.5 h-8 w-[52px] rounded-full bg-blue-50 dark:bg-blue-950/50" />
              )}
              <Icon
                className={`relative h-[19px] w-[19px] transition-colors ${
                  active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                }`}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span className={`relative text-[9px] font-semibold tracking-tight transition-colors ${
                active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* More */}
        <button
          onClick={onMoreOpen}
          className="flex-1 flex flex-col items-center justify-center gap-[3px] relative"
        >
          {moreOpen && (
            <span className="absolute top-2.5 h-8 w-[52px] rounded-full bg-slate-100 dark:bg-slate-800" />
          )}
          {/* Hamburger → becomes 3 dots when open */}
          <span className="relative flex flex-col items-center justify-center gap-[3.5px]">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className={`block rounded-full transition-all duration-200 ${
                  moreOpen
                    ? "w-[3.5px] h-[3.5px] bg-slate-600 dark:bg-slate-300"
                    : i === 1
                      ? "w-[13px] h-[1.5px] bg-slate-400 dark:bg-slate-500"
                      : i === 0
                        ? "w-[16px] h-[1.5px] bg-slate-400 dark:bg-slate-500"
                        : "w-[10px] h-[1.5px] bg-slate-400 dark:bg-slate-500"
                }`}
              />
            ))}
          </span>
          <span className={`relative text-[9px] font-semibold tracking-tight transition-colors ${
            moreOpen ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
          }`}>
            עוד
          </span>
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobile — More Sheet
// ─────────────────────────────────────────────────────────────
function MoreSheet({ open, onClose, groups, user, logout, pathname }) {
  const sheetRef = useRef(null);

  // Trap touches inside sheet
  const handleBackdrop = (e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
  };

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end" onClick={handleBackdrop}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-white dark:bg-[#0f1117] rounded-t-[28px] shadow-2xl"
        style={{
          maxHeight: "80vh",
          marginBottom: "56px",
          animation: "slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1) both",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3.5 pb-1">
          <div className="w-8 h-[3px] rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* User strip */}
        {user && (
          <div className="mx-4 mt-2 mb-3 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow">
                {initials(user?.name)}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">{user?.name}</p>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate max-w-[160px]">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => { logout(); onClose(); }}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/40 px-2.5 py-1.5 rounded-xl"
            >
              <LogOut className="h-3.5 w-3.5" />
              יציאה
            </button>
          </div>
        )}

        {/* Nav grid */}
        <div className="overflow-y-auto overscroll-contain px-4" style={{ maxHeight: "calc(80vh - 130px)" }}>
          {groups.map((group, gi) => {
            const GroupIcon = group.icon;
            return (
              <div key={gi} className="mb-4">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <GroupIcon className="h-3 w-3 text-slate-400" strokeWidth={2} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    {group.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {group.items.map(({ to, label, icon: Icon }) => {
                    const active = isPathActive(to, pathname);
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl text-center transition-all active:scale-95 ${
                          active
                            ? "bg-blue-500 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900"
                            : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <Icon
                          className={`h-[18px] w-[18px] ${active ? "text-white" : "text-slate-500 dark:text-slate-400"}`}
                          strokeWidth={active ? 2.2 : 1.7}
                        />
                        <span className={`text-[9.5px] font-semibold leading-tight px-0.5 ${active ? "text-white" : ""}`}>
                          {label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="h-3" />
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Desktop Sidebar
// ─────────────────────────────────────────────────────────────
function DesktopSidebar({ groups, user, isAuthenticated, logout, onClose }) {
  const { isDark, toggleDark } = useUIStore();
  const location = useLocation();
  const activeGroup = groups.find(group =>
    group.items.some(item => isPathActive(item.to, location.pathname))
  );
  const [panelGroup, setPanelGroup] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setPanelGroup(null);
    setQuery("");
  }, [location.pathname]);

  const selectedGroup = groups.find(group => group.label === panelGroup);
  const normalizedQuery = query.trim().toLocaleLowerCase("he");
  const visibleItems = selectedGroup?.items.filter(item =>
    item.label.toLocaleLowerCase("he").includes(normalizedQuery)
  ) || [];

  const togglePanel = label => {
    setQuery("");
    setPanelGroup(current => current === label ? null : label);
  };

  return (
    <div className="relative h-full w-20">
      <aside className="relative z-20 flex h-full w-20 flex-col items-center border-l border-slate-200 bg-[#fbfcfe] py-3 dark:border-white/[0.08] dark:bg-[#101217]">
        <Link
          to="/"
          onClick={onClose}
          className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-600/20"
          aria-label="fina"
        >
          F
        </Link>

        <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 [scrollbar-width:none]">
          {groups.map(group => {
            const GroupIcon = group.icon;
            const isActive = activeGroup?.label === group.label;
            const isOpen = panelGroup === group.label;
            return (
              <button
                key={group.label}
                type="button"
                onClick={() => togglePanel(group.label)}
                title={group.label}
                aria-label={group.label}
                aria-expanded={isOpen}
                className={`group relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                  isOpen
                    ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-950"
                    : isActive
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                }`}
              >
                {isActive && !isOpen && (
                  <span className="absolute -right-2 h-5 w-[3px] rounded-l-full bg-blue-600" />
                )}
                <GroupIcon className="h-[19px] w-[19px]" strokeWidth={1.8} />
                <span className="pointer-events-none absolute right-[54px] z-50 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg group-hover:block dark:bg-white dark:text-slate-950">
                  {group.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-3 flex flex-col items-center gap-2 border-t border-slate-200 pt-3 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={toggleDark}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label={isDark ? "מצב בהיר" : "מצב כהה"}
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-bold text-white ring-2 ring-white dark:bg-white dark:text-slate-950 dark:ring-[#101217]">
                  {initials(user?.name)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-xl p-1" side="left" align="end" sideOffset={12}>
                <DropdownMenuLabel className="font-normal px-3 py-2">
                  <p className="text-[13px] font-semibold">{user?.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/profile"><UserCircle className="ml-2 h-4 w-4" />פרופיל</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/settings"><Settings className="ml-2 h-4 w-4" />הגדרות</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600"><LogOut className="ml-2 h-4 w-4" />התנתקות</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login" className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white" title="התחברות">
              <UserCircle className="h-5 w-5" />
            </Link>
          )}
        </div>
      </aside>

      {selectedGroup && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-0 cursor-default bg-slate-950/5 backdrop-blur-[1px] dark:bg-black/20"
            onClick={() => setPanelGroup(null)}
            aria-label="סגירת תפריט"
          />
          <section className="absolute right-20 top-0 z-10 flex h-full w-[292px] flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/[0.08] dark:bg-[#15181f] dark:shadow-black/30">
            <header className="px-5 pb-4 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <selectedGroup.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-bold text-slate-950 dark:text-white">{selectedGroup.label}</h2>
                    <p className="text-[10px] text-slate-400">{selectedGroup.items.length} כלים</p>
                  </div>
                </div>
                <button onClick={() => setPanelGroup(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:focus-within:border-blue-500/60">
                <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="חיפוש בתפריט..."
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                  autoFocus
                />
              </label>
            </header>

            <div className="mx-5 h-px bg-slate-100 dark:bg-white/[0.07]" />
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {visibleItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `group flex min-h-12 items-center gap-3 rounded-xl px-3 transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  }`}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`h-[17px] w-[17px] flex-shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"}`} strokeWidth={1.8} />
                      <span className="text-[13px] font-medium">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
              {!visibleItems.length && (
                <p className="px-3 py-8 text-center text-xs text-slate-400">לא נמצאו תוצאות</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function LegacyDesktopSidebar({ groups, user, isAuthenticated, logout, onClose }) {
  const { isDark, toggleDark } = useUIStore();
  const location = useLocation();
  const pinnedPaths = ["/finance-dashboard", "/portfolio", "/budget"];
  const pinnedItems = pinnedPaths
    .map(path => groups.flatMap(group => group.items).find(item => item.to === path))
    .filter(Boolean);
  const menuGroups = groups
    .map(group => ({ ...group, items: group.items.filter(item => !pinnedPaths.includes(item.to)) }))
    .filter(group => group.items.length);

  const [expanded, setExpanded] = useState(() => {
    const init = {};
    let found = false;
    menuGroups.forEach(g => {
      if (g.items.some(i => isPathActive(i.to, location.pathname))) {
        init[g.label] = true;
        found = true;
      }
    });
    if (!found && menuGroups[0]) init[menuGroups[0].label] = true;
    return init;
  });

  useEffect(() => {
    const activeGroup = menuGroups.find(group =>
      group.items.some(item => isPathActive(item.to, location.pathname))
    );
    if (activeGroup) setExpanded(previous => ({ ...previous, [activeGroup.label]: true }));
  }, [location.pathname]);

  const toggle = label => setExpanded(previous => ({
    ...previous,
    [label]: !previous[label],
  }));

  return (
    <aside className="flex h-full flex-col bg-white text-slate-900 dark:bg-[#111318] dark:text-slate-100 border-l border-slate-200/80 dark:border-white/[0.08]">

      {/* Brand */}
      <div className="h-16 px-5 flex items-center justify-between flex-shrink-0">
        <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/20">
            <span className="text-white text-[13px] font-bold">F</span>
          </div>
          <span className="text-lg font-bold tracking-tight">fina</span>
        </Link>
        <button
          onClick={toggleDark}
          aria-label={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.07] dark:hover:text-slate-200 transition-colors"
        >
          {isDark ? <Sun className="h-4 w-4" strokeWidth={1.8} /> : <Moon className="h-4 w-4" strokeWidth={1.8} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
        <div className="space-y-1">
          {pinnedItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/15"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              }`}
            >
              <item.icon className="h-[17px] w-[17px] flex-shrink-0" strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="my-4 h-px bg-slate-100 dark:bg-white/[0.07]" />
        <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.08em] text-slate-400 dark:text-slate-500">
          כל הכלים
        </p>

        <div className="space-y-1">
        {menuGroups.map((group, gi) => {
          const open = expanded[group.label];
          const active = group.items.some(item => isPathActive(item.to, location.pathname));
          return (
            <div key={gi}>
              <button
                onClick={() => toggle(group.label)}
                aria-expanded={open}
                className={`w-full flex h-9 items-center justify-between rounded-lg px-3 transition-colors ${
                  open || active
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <group.icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} strokeWidth={1.8} />
                  <span className="text-[12.5px] font-semibold">{group.label}</span>
                </div>
                <ChevronDown
                  className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                  strokeWidth={2}
                />
              </button>
              {open && (
                <ul className="mb-2 mt-1 space-y-0.5 border-r border-slate-200 pr-3 mr-5 dark:border-white/[0.09]">
                  {group.items.map(item => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12px] font-medium transition-colors ${
                            isActive
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-100"
                          }`
                        }
                      >
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        </div>
      </nav>

      {/* Privacy */}
      <div className="px-5 pb-2">
        <Link to="/privacy" className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          מדיניות פרטיות
        </Link>
      </div>

      {/* User footer */}
      <div className="mx-3 mb-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-1 dark:border-white/[0.07] dark:bg-white/[0.03] flex-shrink-0">
        {isAuthenticated ? (
          <DesktopUserNav user={user} logout={logout} onClose={onClose} />
        ) : (
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            התחברות
          </Link>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Desktop — User Nav
// ─────────────────────────────────────────────────────────────
function DesktopUserNav({ user, logout, onClose }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-start group">
          <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 text-[11px] font-bold flex-shrink-0">
            {initials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
              {user?.name || "משתמש"}
            </p>
            <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{user?.email}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-52 z-[60] rounded-2xl p-1 shadow-xl border-0 bg-white dark:bg-slate-900"
        side="top" align="start" sideOffset={4}
      >
        <DropdownMenuLabel className="font-normal px-3 py-2">
          <p className="font-semibold text-[13px] text-slate-900 dark:text-white">{user?.name}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
        </DropdownMenuLabel>
        <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 mb-1" />
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/profile" onClick={onClose} className="flex items-center gap-2.5 px-3 py-2 text-[13px]">
            <UserCircle className="h-4 w-4 text-slate-400" /> פרופיל
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/settings" onClick={onClose} className="flex items-center gap-2.5 px-3 py-2 text-[13px]">
            <Settings className="h-4 w-4 text-slate-400" /> הגדרות
          </Link>
        </DropdownMenuItem>
        <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 my-1" />
        <DropdownMenuItem
          onClick={logout}
          className="rounded-xl text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> התנתק
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
