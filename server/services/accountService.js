import User from '../models/User.js';
import HouseholdMember from '../models/HouseholdMember.js';

/**
 * accountService — self-service data export + account deletion (Phase 4).
 *
 * Export: a single JSON document with the caller's profile and every business
 * collection they own (GDPR portability). Deletion: anonymize-in-place + soft
 * delete of business data — NOT a hard delete, so Household/AuditLog references
 * are never orphaned. Sessions are killed by bumping tokenVersion.
 */

// [collectionKey, () => import(model), ownerField]. Only models with a real
// per-document owner field are listed, so a filtered query can never leak.
const OWNED_COLLECTIONS = [
  ['transactions',        () => import('../models/Transaction.js'),        'user'],
  ['budgets',             () => import('../models/Budget.js'),             'user'],
  ['goals',               () => import('../models/Goal.js'),               'user'],
  ['loans',               () => import('../models/Loan.js'),              'user'],
  ['categories',          () => import('../models/Category.js'),           'user'],
  ['categoryRules',       () => import('../models/CategoryRule.js'),       'user'],
  ['recurring',           () => import('../models/RecurringTransaction.js'), 'user'],
  ['deposits',            () => import('../models/Deposit.js'),            'user'],
  ['funds',               () => import('../models/Fund.js'),               'user'],
  ['stocks',              () => import('../models/Stock.js'),              'user'],
  ['pension',             () => import('../models/Pension.js'),            'user'],
  ['insurance',           () => import('../models/Insurance.js'),          'user'],
  ['mortgages',           () => import('../models/Mortgage.js'),           'user'],
  ['realEstate',          () => import('../models/RealEstate.js'),         'user'],
  ['childSavings',        () => import('../models/ChildSavings.js'),       'user'],
  ['foreignCurrency',     () => import('../models/ForeignCurrency.js'),    'user'],
  ['maaserDonations',     () => import('../models/MaaserDonation.js'),     'user'],
  ['maaserSettings',      () => import('../models/MaaserSettings.js'),     'user'],
  ['suggestions',         () => import('../models/Suggestion.js'),         'user'],
  ['alerts',              () => import('../models/Alert.js'),              'user'],
  ['netWorthSnapshots',   () => import('../models/NetWorthSnapshot.js'),   'user'],
  ['bankConnections',     () => import('../models/BankConnection.js'),     'user'], // secrets are select:false
  ['projects',            () => import('../models/Project.js'),            'owner'],
];

// Subset that supports the soft-delete plugin — safe to softDeleteMany on delete.
const SOFT_DELETE_ON_DELETE = [
  () => import('../models/Transaction.js'),
  () => import('../models/Budget.js'),
  () => import('../models/Goal.js'),
  () => import('../models/Loan.js'),
  () => import('../models/BankConnection.js'),
];

/**
 * Build the full export document for a user. Returns a plain object suitable for
 * JSON serialization. Never includes select:false secrets (Mongoose omits them).
 */
export const exportAccountData = async (userId) => {
  const user = await User.findById(userId).lean();
  const profile = user
    ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      }
    : null;

  const data = {};
  for (const [key, importer, field] of OWNED_COLLECTIONS) {
    try {
      const Model = (await importer()).default;
      data[key] = await Model.find({ [field]: userId }).lean();
    } catch {
      data[key] = []; // a missing/renamed model must never break the whole export
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    profile,
    data,
  };
};

/**
 * Anonymize the user record and soft-delete their business data. Idempotent-ish
 * (safe to call once; a second call finds an already-scrubbed record).
 * @returns {Promise<{ deleted:boolean }>}
 */
export const anonymizeAndDelete = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { deleted: false };

  // Soft-delete the soft-deletable business collections.
  for (const importer of SOFT_DELETE_ON_DELETE) {
    try {
      const Model = (await importer()).default;
      await Model.softDeleteMany({ user: userId });
    } catch { /* best effort */ }
  }

  // Leave the user's households (so shared members stop seeing them as active).
  await HouseholdMember.updateMany({ user: userId }, { status: 'inactive' });

  // Scrub the identity in place — refs stay valid, sessions die (tokenVersion++).
  user.name = 'חשבון שנמחק';
  user.email = `deleted+${user._id}@fina.local`;
  user.googleId = undefined;
  user.avatar = null;
  user.passwordHash = null;
  user.emailVerified = false;
  user.emailVerifiedAt = null;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  user.twoFactorPendingSecret = null;
  user.twoFactorRecoveryHashes = [];
  user.activeHousehold = null;
  user.deletedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  // Scrubbing clears both passwordHash and googleId, which would trip the
  // "password required unless googleId" validator — skip validation on this save.
  await user.save({ validateBeforeSave: false });

  return { deleted: true };
};
