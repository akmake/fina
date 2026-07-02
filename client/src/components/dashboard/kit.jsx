/**
 * Dashboard design-system kit — dark-mode-aware, RTL primitives.
 *
 * מקור אמת יחיד לצבעים/רקעים של כרטיסים, כותרות, מצבים ריקים וגרפים.
 * כל עמוד חדש צריך לבנות מהפרימיטיבים האלה במקום לקודד צבעים בהירים קשיחים
 * (שהיו שוברים את מצב הכהה). הפלטה תואמת ל-Navbar הקיים.
 */
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

/** כרטיס בסיס — רקע/גבול מתחלפים אוטומטית בין בהיר לכהה */
export function Panel({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] shadow-sm rounded-2xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** כותרת סקשן עם קישור אופציונלי ל"פירוט מלא" */
export function SectionTitle({ icon, title, link, linkLabel }) {
  return (
    <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-white/[0.06] pb-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      {link && (
        <Link
          to={link}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-full"
        >
          {linkLabel} <ChevronLeft className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

/** מצב ריק אחיד — אייקון, כותרת, הסבר, ופעולה ראשית אופציונלית */
export function EmptyState({ icon: Icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-4">
      {Icon && <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />}
      {title && <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>}
      {description && <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>}
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-1 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button
          onClick={onAction}
          className="mt-1 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * ערכת צבעים לגרפי Recharts לפי מצב כהה/בהיר.
 * Recharts לא קורא Tailwind — לכן מזינים לו צבעים מפורשים מכאן.
 */
export function useChartTheme() {
  const isDark = useUIStore((s) => s.isDark);
  return {
    isDark,
    grid: isDark ? '#1e293b' : '#f1f5f9',
    axis: isDark ? '#94a3b8' : '#64748b',
    tooltip: isDark
      ? { backgroundColor: '#0f1117', borderColor: '#1e293b', borderRadius: '8px', color: '#e2e8f0' }
      : { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  };
}

/** פלטת סדרות משותפת לגרפים */
export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
