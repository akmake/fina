// client/src/components/Layout.jsx
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar'; // הייבוא של סרגל הניווט שלך
import { Toaster } from "@/components/ui/toaster";

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 border-l border-slate-200">
        {/* הנחה שקובץ ה-Navbar שלך מכיל את סרגל הניווט הצדדי שבתמונה */}
        <Navbar />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* ה-Outlet הוא המקום שאליו כל שאר העמודים שלך ייכנסו */}
        <Outlet />
      </main>

      {/* Toaster להודעות קופצות */}
      <Toaster />
    </div>
  );
}