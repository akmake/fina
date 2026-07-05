import { lazy, Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Link2, DownloadCloud, FileSpreadsheet, Database } from 'lucide-react';
import { Panel } from '@/components/dashboard/kit';

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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">חיבורים וייבוא</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{activeTab.hint}</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#0f1117] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Panel className="p-0 overflow-hidden">
        <Suspense fallback={<div className="p-10 text-center text-slate-400">טוען…</div>}>
          <ActiveComponent />
        </Suspense>
      </Panel>
    </div>
  );
}
