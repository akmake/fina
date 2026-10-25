import { useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import PageErrorBoundary from './PageErrorBoundary';

// Shown while a code-split page chunk loads.
const PageLoading = () => (
  <div className="flex h-64 items-center justify-center" role="status" aria-label="טוען">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
  </div>
);
import VerifyEmailBanner from './VerifyEmailBanner';
import { Toaster } from 'react-hot-toast';
import { useUIStore } from '@/stores/uiStore';

export default function Layout() {
  const { isDark } = useUIStore();
  const { pathname } = useLocation();
  const isPublicCanvas = ['/login', '/register', '/privacy', '/verify-email'].some(path => pathname.startsWith(path));

  // Keep the <html> class in sync whenever the store value changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="app-shell flex h-screen flex-col text-slate-800 dark:text-slate-100 md:flex-row">
      {/* Sidebar placeholder — keeps the flex flow intact while the navbar is fixed */}
      {!isPublicCanvas && <aside className="hidden w-60 flex-shrink-0 md:block" aria-hidden="true" />}

      {/* Fixed sidebar rendered by Navbar */}
      {!isPublicCanvas && <Navbar />}

      {/* Main content — pt-14 top bar + pb-16 bottom tab bar on mobile */}
      <main className={`app-main ${isPublicCanvas ? 'app-main-public' : 'app-main-system'} flex-1 overflow-y-auto overscroll-contain ${isPublicCanvas ? '' : 'pb-14 pt-14 md:pb-0 md:pt-0'}`}>
        <VerifyEmailBanner />
        <PageErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </main>

      {/* Single toast provider for the whole app */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          className: 'font-sans text-sm',
          duration: 4000,
        }}
      />
    </div>
  );
}
