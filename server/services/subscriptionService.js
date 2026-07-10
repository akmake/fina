import Subscription from '../models/Subscription.js';
import Household from '../models/Household.js';

/**
 * subscriptionService — the plan catalog + household plan resolution (Phase 4).
 *
 * PLANS is the single source of truth for what each tier allows. Limits are
 * enforced server-side (see middlewares/planGate.js); the client only reflects
 * the plan. `-1` means unlimited. Default suggested model (spec Q1): free up to a
 * couple of connected accounts, premium for the full household.
 */

export const PLANS = {
  free: {
    id: 'free',
    name: 'חינם',
    price: 0,
    limits: {
      bankConnections: 2,   // connected bank/card accounts
      householdMembers: 2,  // people sharing the household
    },
    features: {
      autoSync: true,
      advancedReports: false,
      aiInsights: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'פרימיום',
    price: 39, // ₪/month (indicative — no billing wired)
    limits: {
      bankConnections: -1,
      householdMembers: -1,
    },
    features: {
      autoSync: true,
      advancedReports: true,
      aiInsights: true,
    },
  },
};

export const DEFAULT_PLAN = 'free';

/**
 * Fetch (or lazily create) the household's subscription record. Subscription is
 * the canonical plan store; on first create it seeds from the pre-existing
 * `Household.plan` mirror so a household already marked premium isn't reset.
 */
export const getOrCreateForHousehold = async (householdId) => {
  if (!householdId) return null;
  let sub = await Subscription.findOne({ household: householdId });
  if (!sub) {
    const household = await Household.findById(householdId).select('plan').lean();
    const seedPlan = PLANS[household?.plan] ? household.plan : DEFAULT_PLAN;
    sub = await Subscription.create({ household: householdId, plan: seedPlan, status: 'active', provider: 'stub' });
  }
  return sub;
};

/** The active plan id for a household (free when no active/paid subscription). */
export const planFor = async (householdId) => {
  const sub = await getOrCreateForHousehold(householdId);
  if (!sub) return DEFAULT_PLAN;
  // A cancelled/past_due subscription falls back to free access.
  if (sub.status === 'cancelled' || sub.status === 'past_due') return DEFAULT_PLAN;
  return sub.plan;
};

export const planDefinition = (planId) => PLANS[planId] || PLANS[DEFAULT_PLAN];

/**
 * Is `currentCount` (+1 new) within the plan's limit for `limitKey`?
 * Unlimited (-1) always passes.
 */
export const isWithinLimit = (planId, limitKey, currentCount) => {
  const def = planDefinition(planId);
  const limit = def.limits?.[limitKey];
  if (limit == null || limit === -1) return true;
  return currentCount < limit;
};

export const hasFeature = (planId, featureKey) => !!planDefinition(planId).features?.[featureKey];
