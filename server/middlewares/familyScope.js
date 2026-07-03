import mongoose from 'mongoose';
import { resolveActiveHousehold } from '../utils/ensureHousehold.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Resolve the caller's household context. Must run AFTER requireAuth.
 * Sets:
 *   req.household       — the active Household (lean)
 *   req.member          — the caller's HouseholdMember (carries role)
 *   req.householdId     — ObjectId of the active household
 *   req.scopeUsers      — [ObjectId] of all active members (drives scopeFilter)
 *
 * On any failure it degrades to a personal scope (the user alone) so reads
 * never hard-fail on scoping.
 */
export const resolveHousehold = async (req, res, next) => {
  try {
    const { household, member, memberUserIds } = await resolveActiveHousehold(req.user._id);
    req.household = household;
    req.member = member;
    req.householdId = household?._id ? toObjectId(household._id) : null;
    req.scopeUsers = memberUserIds.length ? memberUserIds : [toObjectId(req.user._id)];
  } catch {
    req.household = null;
    req.member = null;
    req.householdId = null;
    req.scopeUsers = [toObjectId(req.user._id)];
  }
  next();
};

/**
 * Block write operations (POST/PUT/PATCH/DELETE) for viewers.
 * Enforces the "viewer = read only" row of the permissions matrix centrally,
 * so individual controllers don't need per-route role checks.
 */
export const blockViewerWrites = (req, res, next) => {
  if (WRITE_METHODS.has(req.method) && req.member?.role === 'viewer') {
    return res.status(403).json({ message: 'לצופה אין הרשאת כתיבה במשק הבית' });
  }
  next();
};

/**
 * Combined middleware used on all household-scoped data routers:
 * resolve the household, then enforce viewer read-only.
 * Kept as a single function so existing `app.use(..., familyScope, ...)` wiring
 * (and its `req.scopeUsers` contract) keeps working unchanged.
 */
export const familyScope = (req, res, next) => {
  resolveHousehold(req, res, (err) => {
    if (err) return next(err);
    blockViewerWrites(req, res, next);
  });
};

export default familyScope;
