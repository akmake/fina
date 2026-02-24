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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Sidebar placeholder — keeps the flex flow intact while the navbar is fixed */}
      <aside className="hidden md:block w-64 flex-shrink-0" aria-hidden="true" />

      {/* Fixed sidebar rendered by Navbar */}
      <Navbar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
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
