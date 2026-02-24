import React from 'react';
import RulesManager from '@/components/dashboard/RulesManager';
import { Bot, Sparkles } from 'lucide-react';

export default function ManagementPage() {
  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen" dir="rtl">
      
      {/* כותרת הדף */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-inner">
            <Bot className="h-8 w-8 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              מרכז האוטומציה
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
              תן למערכת לעבוד בשבילך. הגדר חוקים חכמים לזיהוי, שינוי שם וקיטלוג אוטומטי של עסקאות.
            </p>
          </div>
        </div>
      </header>

      {/* אזור המנוע החדש */}
      <div className="max-w-6xl mx-auto">
        <RulesManager />
      </div>
    </div>
  );
}
