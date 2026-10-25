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
      className={`surface-panel ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** כותרת סקשן עם קישור אופציונלי ל"פירוט מלא" */
export function SectionTitle({ icon, title, link, linkLabel }) {
  return (
    <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/[0.06] pb-3">
      <div className="flex items-center gap-2">
        <div className="section-icon">
          {icon}
        </div>
        <h2 className="font-display text-[14px] font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      {link && (
        <Link
          to={link}
          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1 px-2 py-1 rounded-md"
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
          className="mt-1 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md shadow-blue-600/25 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button
          onClick={onAction}
          className="mt-1 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md shadow-blue-600/25 transition-colors"
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
    grid: isDark ? '#262a40' : '#eef0f7',
    axis: isDark ? '#98a0b8' : '#6b7391',
    tooltip: isDark
      ? { backgroundColor: '#171a2c', borderColor: '#262a40', borderRadius: '14px', color: '#e1e4ef' }
      : { backgroundColor: '#ffffff', borderColor: '#e1e4ef', borderRadius: '14px', boxShadow: '0 12px 28px -10px rgba(63,40,168,.25)' },
  };
}

/** פלטת סדרות משותפת לגרפים */
export const CHART_COLORS = ['#5f3df0', '#14b88a', '#ffb020', '#2fa8ff', '#ff6b6b', '#b2a2ff', '#0e8f6c', '#e0529c'];
