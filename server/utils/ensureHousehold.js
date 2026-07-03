import mongoose from 'mongoose';
import User from '../models/User.js';
import Household from '../models/Household.js';
import HouseholdMember from '../models/HouseholdMember.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

/**
 * Create a personal household for a user (owner membership) if they don't
 * already own one. Returns the household document. Idempotent.
 */
export async function ensurePersonalHousehold(user) {
  const userId = user._id || user.id || user;
  const name = user.name ? `משק הבית של ${user.name}` : 'משק הבית שלי';

  // Reuse an existing owner membership if present
  const existingOwner = await HouseholdMember.findOne({
    user: userId,
    role: 'owner',
    status: 'active',
  }).lean();
  if (existingOwner) {
    return Household.findById(existingOwner.household);
  }

  const household = await Household.create({ name, owner: userId });
  await HouseholdMember.create({
    household: household._id,
    user: userId,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  });
  return household;
}

/**
 * Resolve the household context for a user id. Self-heals: if the user has no
 * active membership (new/legacy user), a personal household is created.
 *
 * Returns { household, member, memberUserIds }.
 */
export async function resolveActiveHousehold(userId) {
  const user = await User.findById(userId).select('activeHousehold name').lean();

  // 1) Prefer the user's declared active household — if they still have an active membership there
  let member = null;
  if (user?.activeHousehold) {
    member = await HouseholdMember.findOne({
      household: user.activeHousehold,
      user: userId,
      status: 'active',
    }).lean();
  }

  // 2) Otherwise fall back to any active membership
  if (!member) {
    member = await HouseholdMember.findOne({ user: userId, status: 'active' })
      .sort({ createdAt: 1 })
      .lean();
    if (member) {
      await User.updateOne({ _id: userId }, { activeHousehold: member.household });
    }
  }

  // 3) Self-heal: no membership at all → create a personal household
  if (!member) {
    const household = await ensurePersonalHousehold(user || { _id: userId });
    await User.updateOne({ _id: userId }, { activeHousehold: household._id });
    member = await HouseholdMember.findOne({ household: household._id, user: userId }).lean();
  }

  const household = await Household.findById(member.household).lean();

  const memberUserIds = (
    await HouseholdMember.find({
      household: member.household,
      status: 'active',
      user: { $type: 'objectId' },
    }).distinct('user')
  ).map((id) => toObjectId(id));

  return { household, member, memberUserIds };
}
