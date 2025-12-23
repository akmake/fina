import React from 'react';
import RulesManager from '@/components/dashboard/RulesManager'; // ייבוא המנוע החדש
import { Settings, Cpu } from 'lucide-react';

export default function ManagementPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-gray-900 min-h-screen" dir="rtl">
      
      {/* כותרת הדף */}
      <header className="flex items-center gap-4 mb-8">
        <div className="bg-brand-secondary/10 p-3 rounded-lg">
          <Settings className="h-8 w-8 text-brand-secondary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            מרכז האוטומציה
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            כאן מגדירים את "המנוע" שמנקה שמות של בתי עסק ומסווג אותם לקטגוריות באופן אוטומטי.
          </p>
        </div>
      </header>

      {/* אזור המנוע החדש */}
      <div className="space-y-6">
        
        <div className="flex items-center gap-2 mb-4 px-1">
            <Cpu className="h-5 w-5 text-brand-primary" />
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                מנוע חוקים ונרמול
            </h2>
        </div>

        {/* הטמעת הרכיב החדש שמנהל את הכל */}
        <RulesManager />
        
      </div>
    </div>
  );
}