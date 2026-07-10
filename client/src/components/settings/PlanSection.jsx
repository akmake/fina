import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Subscription/plan section (Phase 4 scaffold). Shows the household's current
 * plan and lets the owner switch plans. Billing is stubbed — /api/subscription/
 * change flips the plan directly (no real payment yet).
 */
export default function PlanSection() {
  const [current, setCurrent] = useState(null);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get('/subscription').then(({ data }) => setCurrent(data.plan?.id || 'free')).catch(() => setCurrent('free'));
    api.get('/subscription/plans').then(({ data }) => setPlans(data.plans || [])).catch(() => {});
  };
  useEffect(load, []);

  const change = async (plan) => {
    setBusy(true);
    try {
      await api.post('/subscription/change', { plan });
      toast.success(plan === 'premium' ? 'שודרג לפרימיום 🎉' : 'המסלול עודכן');
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'שגיאה בשינוי המסלול'); }
    finally { setBusy(false); }
  };

  return (
    <Card className="dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg dark:text-slate-100">
          <Crown className="h-5 w-5 text-amber-500" />
          המסלול שלך
        </CardTitle>
        <CardDescription>ניהול המנוי של משק הבית. סליקת תשלום אמיתית טרם חוברה (הדגמה).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-3">
          {plans.map((p) => {
            const isCurrent = current === p.id;
            return (
              <div key={p.id} className={`rounded-2xl border p-4 flex flex-col ${isCurrent ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                  {isCurrent && <Badge className="bg-blue-100 text-blue-700 border-blue-200">נוכחי</Badge>}
                </div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">
                  {p.price === 0 ? 'חינם' : <>₪{p.price}<span className="text-sm font-medium text-slate-400"> /חודש</span></>}
                </p>
                <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 flex-1 mb-3">
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> {p.limits?.bankConnections === -1 ? 'חשבונות מחוברים ללא הגבלה' : `עד ${p.limits?.bankConnections} חשבונות מחוברים`}</li>
                  <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> {p.limits?.householdMembers === -1 ? 'בני משפחה ללא הגבלה' : `עד ${p.limits?.householdMembers} בני משפחה`}</li>
                  {p.features?.advancedReports && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> דוחות מתקדמים</li>}
                  {p.features?.aiInsights && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> תובנות AI</li>}
                </ul>
                {!isCurrent && (
                  <Button onClick={() => change(p.id)} disabled={busy} className="gap-2" variant={p.id === 'premium' ? 'default' : 'outline'}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {p.id === 'premium' ? 'שדרג' : 'עבור למסלול זה'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
