import { lazy, Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3, PiggyBank, GraduationCap, Globe, Building2 } from 'lucide-react';
import { Panel } from '@/components/dashboard/kit';

/*
 * PortfolioHubPage — "תיק נכסים" אחד עם טאבים (Phase 3, §6.1).
 * מאחד את עמודי הנכסים הנפרדים (מניות, קרנות, פיקדונות, פנסיה, מט"ח, נדל"ן)
 * לעמוד יחיד. הטאב הפעיל נגזר מה-URL כדי לשמור deep-linking ותאימות ל-nav.
 */

const InvestmentsPage = lazy(() => import('@/pages/InvestmentsPage'));
const FundsPage = lazy(() => import('@/pages/FundsPage'));
const DepositsPage = lazy(() => import('@/pages/DepositsPage'));
const PensionPage = lazy(() => import('@/pages/PensionPage'));
const ForeignCurrencyPage = lazy(() => import('@/pages/ForeignCurrencyPage'));
const RealEstatePage = lazy(() => import('@/pages/RealEstatePage'));

const TABS = [
  { key: 'investments', label: 'מניות', icon: TrendingUp, path: '/investments', Component: InvestmentsPage },
  { key: 'funds', label: 'קרנות', icon: BarChart3, path: '/funds', Component: FundsPage },
  { key: 'deposits', label: 'פיקדונות', icon: PiggyBank, path: '/deposits', Component: DepositsPage },
  { key: 'pension', label: 'פנסיה', icon: GraduationCap, path: '/pension', Component: PensionPage },
  { key: 'fx', label: 'מט"ח', icon: Globe, path: '/foreign-currency', Component: ForeignCurrencyPage },
  { key: 'real-estate', label: 'נדל"ן', icon: Building2, path: '/real-estate', Component: RealEstatePage },
];

const pathToTab = (pathname) => {
  if (pathname.startsWith('/funds')) return 'funds';
  if (pathname.startsWith('/deposits')) return 'deposits';
  if (pathname.startsWith('/pension')) return 'pension';
  if (pathname.startsWith('/foreign-currency')) return 'fx';
  if (pathname.startsWith('/real-estate')) return 'real-estate';
  return 'investments'; // /assets, /investments
};

export default function PortfolioHubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = useMemo(() => pathToTab(location.pathname), [location.pathname]);
  const ActiveComponent = (TABS.find((t) => t.key === active) || TABS[0]).Component;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">תיק נכסים</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">כל הנכסים במקום אחד — מניות, קרנות, פיקדונות, פנסיה, מט"ח ונדל"ן.</p>
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
