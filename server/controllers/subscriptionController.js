import Household from '../models/Household.js';
import { PLANS, getOrCreateForHousehold, planFor, planDefinition } from '../services/subscriptionService.js';
import { audit } from '../utils/audit.js';

/**
 * subscriptionController — plan visibility + (stubbed) plan changes (Phase 4).
 * Scoped to the household (req.householdId via familyScope). No payment provider
 * is wired: `change` flips the plan directly (`provider:'stub'`). A real Stripe/
 * Paddle checkout + webhook replaces `changePlan` later.
 */

// GET /api/subscription — the household's current plan + status
export const getSubscription = async (req, res) => {
  try {
    const sub = await getOrCreateForHousehold(req.householdId);
    const planId = await planFor(req.householdId);
    return res.json({
      subscription: sub
        ? { plan: sub.plan, status: sub.status, provider: sub.provider, periodEnd: sub.periodEnd }
        : { plan: 'free', status: 'active', provider: 'stub', periodEnd: null },
      plan: { id: planId, ...planDefinition(planId) },
    });
  } catch (error) {
    console.error('getSubscription error:', error);
    return res.status(500).json({ message: 'שגיאה בטעינת המנוי' });
  }
};

// GET /api/subscription/plans — the plan catalog (for pricing UI)
export const listPlans = async (_req, res) => {
  return res.json({ plans: Object.values(PLANS) });
};

// POST /api/subscription/change { plan } — STUB: no billing, flips the plan directly.
// Owner-only (billing is the owner's decision).
export const changePlan = async (req, res) => {
  try {
    if (req.member?.role && req.member.role !== 'owner') {
      return res.status(403).json({ message: 'רק בעל/ת משק הבית יכול/ה לשנות מסלול' });
    }
    const { plan } = req.body || {};
    if (!PLANS[plan]) return res.status(400).json({ message: 'מסלול לא תקין' });

    const sub = await getOrCreateForHousehold(req.householdId);
    if (!sub) return res.status(400).json({ message: 'אין משק בית פעיל' });

    const before = sub.plan;
    sub.plan = plan;
    sub.status = 'active';
    sub.provider = 'stub';
    // No real billing period; premium is open-ended in the stub.
    sub.periodEnd = plan === 'premium' ? null : null;
    sub.canceledAt = null;
    await sub.save();

    // Keep the denormalized Household.plan mirror in sync (exposed by /api/household).
    await Household.updateOne({ _id: req.householdId }, { plan });

    await audit(req, 'subscription.change', 'Subscription', {
      entityId: sub._id, before: { plan: before }, after: { plan },
    });

    return res.json({
      message: plan === 'premium' ? 'שודרג לפרימיום' : 'המסלול עודכן',
      subscription: { plan: sub.plan, status: sub.status, provider: sub.provider, periodEnd: sub.periodEnd },
      note: 'סליקת תשלום אמיתית טרם חוברה (stub).',
    });
  } catch (error) {
    console.error('changePlan error:', error);
    return res.status(500).json({ message: 'שגיאה בשינוי המסלול' });
  }
};
