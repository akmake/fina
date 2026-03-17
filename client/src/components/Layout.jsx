import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { Toaster } from 'react-hot-toast';
import { useUIStore } from '@/stores/uiStore';

export default function Layout() {
  const { isDark } = useUIStore();

  // Keep the <html> class in sync whenever the store value changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Sidebar placeholder — keeps the flex flow intact while the navbar is fixed */}
      <aside className="hidden md:block w-64 flex-shrink-0" aria-hidden="true" />

      {/* Fixed sidebar rendered by Navbar */}
      <Navbar />

      {/* Main content — pt-14 top bar + pb-16 bottom tab bar on mobile */}
      <main className="flex-1 overflow-y-auto pt-14 pb-14 md:pt-0 md:pb-0 overscroll-contain">
        <Outlet />
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
