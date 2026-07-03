import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Household — the tenant (unit of ownership) for all household-scoped data.
 * Replaces/extends the legacy FamilyGroup. Every user belongs to at least one
 * Household (their personal one, created on registration or by migration).
 *
 * Membership + roles live in the separate HouseholdMember model.
 */
const householdSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: 'משק הבית שלי' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Billing plan — Q1 default: freemium (see product-spec-v2 §2)
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    // A personal household is a user's private, auto-created tenant. It becomes
    // a shared "family" (isPersonal=false) once named/shared or joined by others.
    // Drives the legacy /api/family compatibility shim.
    isPersonal: { type: Boolean, default: true },
    // Simple shareable join code (parallel to email invitations)
    inviteCode: { type: String, unique: true },
  },
  { timestamps: true }
);

householdSchema.pre('save', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

householdSchema.index({ owner: 1 });

export default mongoose.models.Household || mongoose.model('Household', householdSchema);
