import mongoose from 'mongoose';

/**
 * Subscription — the billing record, scoped to a Household (the billing unit,
 * spec §A5). Phase 4 scaffolds plans + gating; no payment provider is wired yet
 * (`provider: 'stub'`), so plan changes are applied directly. When Stripe/Paddle
 * lands, add customer/subscription ids + a webhook that mutates `status`.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    household: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Household',
      required: true,
      unique: true,
      index: true,
    },
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'cancelled'],
      default: 'active',
    },
    provider: { type: String, enum: ['stub', 'manual', 'stripe', 'paddle'], default: 'stub' },
    // Provider handles (populated once a real provider is wired).
    providerCustomerId: { type: String, default: null },
    providerSubscriptionId: { type: String, default: null },
    // End of the current paid period (null on free / open-ended).
    periodEnd: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
