import React from 'react';
import RulesManager from '@/components/dashboard/RulesManager';
import { Bot } from 'lucide-react';

export default function ManagementPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen" dir="rtl">

      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
            ניהול אוטומציה
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            חוקים לזיהוי וקיטלוג אוטומטי של עסקאות
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <RulesManager />
      </div>
    </div>
  );
}
