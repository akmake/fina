import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Catches a crash inside one page so the app shell (navigation) stays usable.
 * Layout keys it by pathname, so navigating elsewhere clears the error.
 * A failed lazy chunk (e.g. after a deploy) is offered a full reload.
 */
export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(error?.message || '');
    return (
      <div className="page-shell" dir="rtl" role="alert">
        <div className="surface-panel mx-auto mt-10 max-w-lg p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isChunkError ? 'יצאה גרסה חדשה של המערכת' : 'המסך הזה נתקל בשגיאה'}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {isChunkError
              ? 'צריך לטעון את הדף מחדש כדי להמשיך.'
              : 'שאר המערכת ממשיכה לעבוד. אפשר לנסות שוב או לעבור למסך אחר מהתפריט.'}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => (isChunkError ? window.location.reload() : this.setState({ error: null }))}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              {isChunkError ? 'טעינה מחדש' : 'ניסיון נוסף'}
            </button>
            <a href="/finance-dashboard" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-200 dark:hover:bg-white/[0.05]">
              לדשבורד
            </a>
          </div>
        </div>
      </div>
    );
  }
}
