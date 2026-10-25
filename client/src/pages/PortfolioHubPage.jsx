import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, BarChart3, PiggyBank, GraduationCap, Globe, Building2 } from 'lucide-react';

/*
 * PortfolioHubPage — "תיק נכסים" אחד עם טאבים (Phase 3, §6.1).
 * מאחד את עמודי הנכסים הנפרדים (מניות, קרנות, פיקדונות, פנסיה, מט"ח, נדל"ן)
 * לעמוד יחיד. הטאב הפעיל נגזר מה-URL כדי לשמור deep-linking ותאימות ל-nav.
 */

import InvestmentsPage from '@/pages/InvestmentsPage';
import FundsPage from '@/pages/FundsPage';
import DepositsPage from '@/pages/DepositsPage';
import PensionPage from '@/pages/PensionPage';
import ForeignCurrencyPage from '@/pages/ForeignCurrencyPage';
import RealEstatePage from '@/pages/RealEstatePage';

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
    <div className="page-shell" dir="rtl">
      <header className="page-header">
        <div>
          <p className="eyebrow">מרכז ההון</p>
          <h1 className="page-title">הנכסים עובדים בשבילך?</h1>
          <p className="page-description">ביצועים, פיזור וסיכון של כל שכבות ההון במקום אחד.</p>
        </div>
      </header>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[#e4dfd4] bg-[#fffefa] p-1.5 dark:border-white/[0.07] dark:bg-slate-900" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => navigate(tab.path)}
              className={`relative flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#111722] text-white dark:bg-white dark:text-[#111722]'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-w-0"><ActiveComponent /></div>
    </div>
  );
}
