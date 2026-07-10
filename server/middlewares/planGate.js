import { planFor, hasFeature, isWithinLimit } from '../services/subscriptionService.js';

/**
 * planGate — server-side enforcement of subscription plans (Phase 4).
 * Must run AFTER familyScope (needs req.householdId). Never trust a client plan.
 */

/** Require a specific feature flag from the household's plan. */
export const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    const plan = await planFor(req.householdId);
    if (!hasFeature(plan, featureKey)) {
      return res.status(402).json({
        message: 'הפיצ׳ר הזה זמין במסלול פרימיום',
        code: 'PLAN_UPGRADE_REQUIRED',
        feature: featureKey,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Enforce a countable free-tier cap. `countFn(req)` returns the current count of
 * the resource in the household; the request is blocked when adding one more
 * would exceed the plan's limit.
 */
export const enforceLimit = (limitKey, countFn) => async (req, res, next) => {
  try {
    const plan = await planFor(req.householdId);
    const current = await countFn(req);
    if (!isWithinLimit(plan, limitKey, current)) {
      return res.status(402).json({
        message: 'הגעת למגבלת המסלול. שדרג/י לפרימיום כדי להוסיף עוד.',
        code: 'PLAN_LIMIT_REACHED',
        limit: limitKey,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};
