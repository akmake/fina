import mongoose from 'mongoose';

/**
 * HouseholdMember — the join between a User and a Household, carrying the
 * household-level role (owner / partner / viewer) and invitation state.
 *
 * Invitation lifecycle:
 *   invited → (accept) → active → (remove/leave) → removed
 * A pending invitation may have `user: null` (only the invited email is known)
 * until the invitee accepts.
 */
const householdMemberSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    role: { type: String, enum: ['owner', 'partner', 'viewer'], required: true },
    status: { type: String, enum: ['invited', 'active', 'removed'], default: 'active', index: true },

    // Invitation metadata
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    invitedEmail: { type: String, lowercase: true, trim: true, default: null },
    inviteToken: { type: String, default: null },
    tokenExpires: { type: Date, default: null },

    joinedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A user can appear at most once (non-removed) per household
householdMemberSchema.index(
  { household: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' }, status: { $ne: 'removed' } } }
);

// A given email can have at most one pending invitation per household
householdMemberSchema.index(
  { household: 1, invitedEmail: 1 },
  { unique: true, partialFilterExpression: { status: 'invited' } }
);

// Fast token lookup on accept
householdMemberSchema.index({ inviteToken: 1 }, { sparse: true });

export default mongoose.models.HouseholdMember || mongoose.model('HouseholdMember', householdMemberSchema);
