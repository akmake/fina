/**
 * One-off, idempotent migration: introduce Households for all existing data.
 *
 *   node scripts/migrateToHouseholds.js
 *
 * Rules:
 *   1. Each existing FamilyGroup  → a Household. createdBy → owner (owner role),
 *      other members → partner. Each member's User.activeHousehold is set.
 *   2. Each User without any active HouseholdMember → a personal Household
 *      (owner role), and User.activeHousehold is set.
 *
 * Safe to run multiple times: it skips users/groups already migrated.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import FamilyGroup from '../models/FamilyGroup.js';
import Household from '../models/Household.js';
import HouseholdMember from '../models/HouseholdMember.js';
import { ensurePersonalHousehold } from '../utils/ensureHousehold.js';

dotenv.config();

async function migrateFamilyGroups() {
  const groups = await FamilyGroup.find().lean();
  let created = 0;

  for (const group of groups) {
    const ownerId = group.createdBy;
    if (!ownerId) continue;

    // Already migrated? (owner already has an active membership somewhere shared)
    const existing = await HouseholdMember.findOne({
      user: ownerId,
      role: 'owner',
      status: 'active',
    }).lean();

    let householdId;
    if (existing) {
      householdId = existing.household;
    } else {
      const household = await Household.create({
        name: group.name || 'המשפחה שלנו',
        owner: ownerId,
        isPersonal: false,
        inviteCode: group.inviteCode, // preserve existing code when possible
      });
      householdId = household._id;
      await HouseholdMember.create({
        household: householdId,
        user: ownerId,
        role: 'owner',
        status: 'active',
        joinedAt: group.createdAt || new Date(),
      });
      await User.updateOne({ _id: ownerId }, { activeHousehold: householdId });
      created += 1;
    }

    // Non-owner members → partners
    for (const memberId of group.members || []) {
      if (memberId.toString() === ownerId.toString()) continue;
      const has = await HouseholdMember.findOne({
        household: householdId,
        user: memberId,
        status: { $ne: 'removed' },
      }).lean();
      if (has) continue;
      await HouseholdMember.create({
        household: householdId,
        user: memberId,
        role: 'partner',
        status: 'active',
        joinedAt: new Date(),
      });
      await User.updateOne({ _id: memberId }, { activeHousehold: householdId });
      // mark shared
      await Household.updateOne({ _id: householdId }, { isPersonal: false });
    }
  }
  return created;
}

async function migrateOrphanUsers() {
  const users = await User.find().select('_id name activeHousehold').lean();
  let created = 0;
  for (const user of users) {
    const membership = await HouseholdMember.findOne({ user: user._id, status: 'active' }).lean();
    if (membership) {
      if (!user.activeHousehold) {
        await User.updateOne({ _id: user._id }, { activeHousehold: membership.household });
      }
      continue;
    }
    const household = await ensurePersonalHousehold(user);
    await User.updateOne({ _id: user._id }, { activeHousehold: household._id });
    created += 1;
  }
  return created;
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing — aborting');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[migrate] connected');

  const fromGroups = await migrateFamilyGroups();
  console.log(`[migrate] households created from FamilyGroups: ${fromGroups}`);

  const personal = await migrateOrphanUsers();
  console.log(`[migrate] personal households created for orphan users: ${personal}`);

  await mongoose.disconnect();
  console.log('[migrate] done');
}

run().catch(async (err) => {
  console.error('[migrate] failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
