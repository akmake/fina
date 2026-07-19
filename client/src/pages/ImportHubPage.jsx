import { lazy, Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Link2, DownloadCloud, FileSpreadsheet, Database, Loader2 } from 'lucide-react';

/*
 * ImportHubPage — אשף ייבוא/חיבורים אחד (Phase 3, §6.1).
 * מאחד את כל עמודי הייבוא הנפרדים לטאבים בעמוד יחיד:
 *   - חיבורים אוטומטיים (BankConnection, ליבת Import 2.0)
 *   - ייבוא חד-פעמי מהבנק (scrape ידני)
 *   - אקסל / CSV
 *   - העברה מתוכנה ישנה (SQLite)
 * הטאב הפעיל נגזר מה-URL כדי לשמור על deep-linking והתאמה ל-nav הישן.
 */

const BankConnectionsPage = lazy(() => import('@/pages/BankConnectionsPage'));
const AutoImportPage = lazy(() => import('@/pages/AutoImportPage'));
const ExcelImportPage = lazy(() => import('@/pages/ExcelImportPage'));
const LegacySqliteImportPage = lazy(() => import('@/pages/ImportPage'));

const TABS = [
  { key: 'connections', label: 'חיבורים אוטומטיים', icon: Link2, path: '/connections', Component: BankConnectionsPage,
    hint: 'חבר בנק/אשראי פעם אחת — Fina מסנכרן אוטומטית כל יום.' },
  { key: 'auto', label: 'ייבוא חד-פעמי', icon: DownloadCloud, path: '/import/auto', Component: AutoImportPage,
    hint: 'משיכה חד-פעמית מהבנק בלי לשמור פרטי התחברות.' },
  { key: 'excel', label: 'אקסל / CSV', icon: FileSpreadsheet, path: '/import/excel', Component: ExcelImportPage,
    hint: 'העלאת קובץ תנועות שהורדת מהבנק.' },
  { key: 'sqlite', label: 'העברה מתוכנה ישנה', icon: Database, path: '/import/sqlite', Component: LegacySqliteImportPage,
    hint: 'ייבוא חד-פעמי ממסד נתונים ישן (.db).' },
];

const pathToTab = (pathname) => {
  if (pathname.startsWith('/import/excel')) return 'excel';
  if (pathname.startsWith('/import/auto')) return 'auto';
  if (pathname.startsWith('/import/sqlite')) return 'sqlite';
  if (pathname.startsWith('/import/cal') || pathname.startsWith('/import/max') || pathname.startsWith('/discount-import')) return 'auto';
  // /connections, /import/connections, /import → החיבורים הם ברירת המחדל
  return 'connections';
};

export default function ImportHubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = useMemo(() => pathToTab(location.pathname), [location.pathname]);
  const activeTab = TABS.find((t) => t.key === active) || TABS[0];
  const ActiveComponent = activeTab.Component;
  const ActiveIcon = activeTab.icon;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7" dir="rtl">
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm dark:border-white/[0.08] dark:bg-[#0f1117] dark:text-slate-400">
            <ActiveIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            {activeTab.label}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">חיבורים וייבוא</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{activeTab.hint}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-white/[0.08] dark:bg-[#0f1117] sm:flex" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => navigate(tab.path)}
                className={`flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="min-h-[520px]">
        <Suspense
          fallback={(
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm dark:border-white/[0.08] dark:bg-[#0f1117]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        >
          <ActiveComponent />
        </Suspense>
      </main>
    </div>
  );
}
