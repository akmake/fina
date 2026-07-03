import crypto from 'crypto';
import mongoose from 'mongoose';
import Household from '../models/Household.js';
import HouseholdMember from '../models/HouseholdMember.js';
import User from '../models/User.js';
import { ensurePersonalHousehold } from '../utils/ensureHousehold.js';
import { audit } from '../utils/audit.js';

const INVITE_TTL_DAYS = 7;

// Shape a household + its members for the client
async function serializeHousehold(householdId) {
  const household = await Household.findById(householdId)
    .populate('owner', 'name email avatar')
    .lean();
  if (!household) return null;

  const members = await HouseholdMember.find({
    household: householdId,
    status: { $ne: 'removed' },
  })
    .populate('user', 'name email avatar')
    .sort({ createdAt: 1 })
    .lean();

  return {
    _id: household._id,
    name: household.name,
    plan: household.plan,
    inviteCode: household.inviteCode,
    owner: household.owner,
    members: members.map((m) => ({
      _id: m._id,
      role: m.role,
      status: m.status,
      user: m.user, // null for a still-pending email invite
      invitedEmail: m.invitedEmail,
      joinedAt: m.joinedAt,
    })),
  };
}

// ── GET /api/household ───────────────────────────────────────────────────────
export const getHousehold = async (req, res) => {
  try {
    const data = await serializeHousehold(req.household._id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/household/name ──────────────────────────────────────────────────
export const renameHousehold = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'שם משק בית חסר' });
    await Household.updateOne({ _id: req.household._id }, { name });
    res.json(await serializeHousehold(req.household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/household/invite ───────────────────────────────────── owner ──
// body: { email, role }  → creates a pending invitation with a token
export const inviteMember = async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const role = req.body.role;
    if (!email) return res.status(400).json({ message: 'אימייל להזמנה חסר' });
    if (!['partner', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'תפקיד לא תקין (partner או viewer)' });
    }

    const householdId = req.household._id;

    // Already an active member of THIS household?
    const existingUser = await User.findOne({ email }).select('_id').lean();
    if (existingUser) {
      const already = await HouseholdMember.findOne({
        household: householdId,
        user: existingUser._id,
        status: 'active',
      }).lean();
      if (already) return res.status(400).json({ message: 'המשתמש כבר חבר במשק הבית' });
    }

    // Reuse/refresh a pending invite for the same email
    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await HouseholdMember.findOneAndUpdate(
      { household: householdId, invitedEmail: email, status: 'invited' },
      {
        household: householdId,
        invitedEmail: email,
        user: existingUser?._id || null,
        role,
        status: 'invited',
        invitedBy: req.user._id,
        inviteToken: token,
        tokenExpires,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await audit(req, 'household.invite', 'HouseholdMember', {
      entityId: invite._id,
      after: { invitedEmail: email, role },
    });

    // Token is returned so the client can build the invite link / show it.
    // (Email delivery is wired in Phase 3 — Notifications.)
    res.status(201).json({
      message: 'ההזמנה נוצרה',
      invite: { _id: invite._id, invitedEmail: email, role, token, tokenExpires },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'כבר קיימת הזמנה פתוחה לאימייל זה' });
    }
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/household/accept ───────────────────────────────────────────────
// body: { token }  → the logged-in user accepts an invitation
export const acceptInvite = async (req, res) => {
  try {
    const token = (req.body.token || '').trim();
    if (!token) return res.status(400).json({ message: 'טוקן הזמנה חסר' });

    const invite = await HouseholdMember.findOne({ inviteToken: token, status: 'invited' });
    if (!invite) return res.status(404).json({ message: 'הזמנה לא נמצאה או כבר נוצלה' });
    if (invite.tokenExpires && invite.tokenExpires < new Date()) {
      return res.status(410).json({ message: 'ההזמנה פגה — בקש מהמזמין לשלוח שוב' });
    }

    // Guard: don't double-join
    const already = await HouseholdMember.findOne({
      household: invite.household,
      user: req.user._id,
      status: 'active',
    }).lean();
    if (already) return res.status(400).json({ message: 'כבר חבר במשק הבית' });

    invite.user = req.user._id;
    invite.status = 'active';
    invite.joinedAt = new Date();
    invite.inviteToken = null;
    invite.tokenExpires = null;
    await invite.save();

    await User.updateOne({ _id: req.user._id }, { activeHousehold: invite.household });
    await Household.updateOne({ _id: invite.household }, { isPersonal: false });

    await audit(req, 'household.join', 'HouseholdMember', { entityId: invite._id });

    res.json(await serializeHousehold(invite.household));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/household/join-code ────────────────────────────────────────────
// body: { code }  → join by the household's shareable invite code (as a partner)
export const joinByCode = async (req, res) => {
  try {
    const code = (req.body.code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ message: 'קוד הזמנה חסר' });

    const household = await Household.findOne({ inviteCode: code });
    if (!household) return res.status(404).json({ message: 'קוד הזמנה לא תקין' });

    const already = await HouseholdMember.findOne({
      household: household._id,
      user: req.user._id,
      status: 'active',
    }).lean();
    if (already) return res.status(400).json({ message: 'כבר חבר במשק הבית' });

    const member = await HouseholdMember.create({
      household: household._id,
      user: req.user._id,
      role: 'partner',
      status: 'active',
      joinedAt: new Date(),
    });
    await User.updateOne({ _id: req.user._id }, { activeHousehold: household._id });
    await Household.updateOne({ _id: household._id }, { isPersonal: false });

    await audit(req, 'household.join', 'HouseholdMember', { entityId: member._id });

    res.json(await serializeHousehold(household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/household/members/:memberId/role ────────────────────── owner ──
export const changeMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['owner', 'partner', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'תפקיד לא תקין' });
    }

    const member = await HouseholdMember.findOne({
      _id: req.params.memberId,
      household: req.household._id,
      status: { $ne: 'removed' },
    });
    if (!member) return res.status(404).json({ message: 'חבר לא נמצא' });

    // Never leave the household without an owner
    if (member.role === 'owner' && role !== 'owner') {
      const owners = await HouseholdMember.countDocuments({
        household: req.household._id,
        role: 'owner',
        status: 'active',
      });
      if (owners <= 1) return res.status(400).json({ message: 'חייב להישאר לפחות בעל בית אחד' });
    }

    const before = { role: member.role };
    member.role = role;
    await member.save();

    // Keep Household.owner in sync when promoting to owner
    if (role === 'owner' && member.user) {
      await Household.updateOne({ _id: req.household._id }, { owner: member.user });
    }

    await audit(req, 'household.role.change', 'HouseholdMember', {
      entityId: member._id,
      before,
      after: { role },
    });

    res.json(await serializeHousehold(req.household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/household/members/:memberId ──────────────────────── owner ──
export const removeMember = async (req, res) => {
  try {
    const member = await HouseholdMember.findOne({
      _id: req.params.memberId,
      household: req.household._id,
      status: { $ne: 'removed' },
    });
    if (!member) return res.status(404).json({ message: 'חבר לא נמצא' });

    if (member.user && member.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'להסרה עצמית השתמש ב"עזוב משק בית"' });
    }
    if (member.role === 'owner') {
      return res.status(400).json({ message: 'אי אפשר להסיר בעל בית — שנה קודם את תפקידו' });
    }

    member.status = 'removed';
    await member.save();

    // If the removed user was acting in this household, reset them to a personal one
    if (member.user) {
      const removedUser = await User.findById(member.user).select('activeHousehold name').lean();
      if (removedUser?.activeHousehold?.toString() === req.household._id.toString()) {
        const personal = await ensurePersonalHousehold(removedUser || { _id: member.user });
        await User.updateOne({ _id: member.user }, { activeHousehold: personal._id });
      }
    }

    await audit(req, 'household.member.remove', 'HouseholdMember', { entityId: member._id });

    res.json(await serializeHousehold(req.household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/household/leave ────────────────────────────────────────────────
export const leaveHousehold = async (req, res) => {
  try {
    const member = await HouseholdMember.findOne({
      household: req.household._id,
      user: req.user._id,
      status: 'active',
    });
    if (!member) return res.status(400).json({ message: 'אינך חבר פעיל במשק בית זה' });

    if (member.role === 'owner') {
      const others = await HouseholdMember.countDocuments({
        household: req.household._id,
        status: 'active',
        user: { $ne: req.user._id, $type: 'objectId' },
      });
      if (others > 0) {
        return res.status(400).json({ message: 'העבר בעלות לחבר אחר לפני עזיבה' });
      }
    }

    member.status = 'removed';
    await member.save();

    // Move the user back to a personal household
    const user = await User.findById(req.user._id).select('name').lean();
    const personal = await ensurePersonalHousehold(user || { _id: req.user._id });
    await User.updateOne({ _id: req.user._id }, { activeHousehold: personal._id });

    await audit(req, 'household.leave', 'HouseholdMember', { entityId: member._id });

    res.json({ message: 'עזבת את משק הבית' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/household/switch ───────────────────────────────────────────────
// body: { householdId }  → switch the active household (multi-household users)
export const switchHousehold = async (req, res) => {
  try {
    const { householdId } = req.body;
    if (!mongoose.isValidObjectId(householdId)) {
      return res.status(400).json({ message: 'מזהה משק בית לא תקין' });
    }
    const member = await HouseholdMember.findOne({
      household: householdId,
      user: req.user._id,
      status: 'active',
    }).lean();
    if (!member) return res.status(403).json({ message: 'אינך חבר במשק בית זה' });

    await User.updateOne({ _id: req.user._id }, { activeHousehold: householdId });
    res.json(await serializeHousehold(householdId));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/household/mine ──────────────────────────────────────────────────
// All households the user is an active member of (for a switcher UI)
export const listMyHouseholds = async (req, res) => {
  try {
    const memberships = await HouseholdMember.find({ user: req.user._id, status: 'active' })
      .populate('household', 'name plan')
      .lean();
    const active = req.household?._id?.toString();
    res.json(
      memberships
        .filter((m) => m.household)
        .map((m) => ({
          _id: m.household._id,
          name: m.household.name,
          plan: m.household.plan,
          role: m.role,
          isActive: m.household._id.toString() === active,
        }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
