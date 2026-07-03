/**
 * Legacy /api/family compatibility shim.
 *
 * The canonical tenancy API is now /api/household (see householdController.js).
 * This shim keeps the existing client FamilyPage working by mapping the old
 * FamilyGroup-shaped contract onto Households:
 *   - "family" == the caller's active Household once it is shared (isPersonal=false)
 *   - a personal (private) household reports as `null` so the UI still offers
 *     create / join.
 *
 * Requires resolveHousehold to have run (req.household / req.member populated).
 */
import Household from '../models/Household.js';
import HouseholdMember from '../models/HouseholdMember.js';
import User from '../models/User.js';

async function shapeFamily(householdId) {
  const household = await Household.findById(householdId)
    .populate('owner', 'name email')
    .lean();
  if (!household) return null;

  const members = await HouseholdMember.find({ household: householdId, status: 'active' })
    .populate('user', 'name email avatar')
    .lean();

  return {
    _id: household._id,
    name: household.name,
    inviteCode: household.inviteCode,
    createdBy: household.owner,
    members: members.filter((m) => m.user).map((m) => m.user),
  };
}

// ── GET /api/family ──────────────────────────────────────────────────────────
export const getFamily = async (req, res) => {
  try {
    if (!req.household || req.household.isPersonal) return res.json(null);
    res.json(await shapeFamily(req.household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/family/create ──────────────────────────────────────────────────
// Turns the caller's (personal) active household into a shared, named family.
export const createFamily = async (req, res) => {
  try {
    if (!req.household) return res.status(400).json({ message: 'אין הקשר משק בית' });
    if (!req.household.isPersonal) {
      return res.status(400).json({ message: 'כבר שייך לקבוצה משפחתית' });
    }
    if (req.member?.role !== 'owner') {
      return res.status(403).json({ message: 'רק בעל הבית יכול ליצור קבוצה' });
    }

    await Household.updateOne(
      { _id: req.household._id },
      { name: (req.body.name || '').trim() || 'המשפחה שלנו', isPersonal: false }
    );

    res.status(201).json(await shapeFamily(req.household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/family/join ────────────────────────────────────────────────────
export const joinFamily = async (req, res) => {
  try {
    const inviteCode = (req.body.inviteCode || '').toUpperCase().trim();
    if (!inviteCode) return res.status(400).json({ message: 'קוד הזמנה חסר' });

    const household = await Household.findOne({ inviteCode });
    if (!household) return res.status(404).json({ message: 'קוד הזמנה לא תקין' });

    const already = await HouseholdMember.findOne({
      household: household._id,
      user: req.user._id,
      status: 'active',
    }).lean();
    if (already) return res.status(400).json({ message: 'כבר חבר בקבוצה' });

    await HouseholdMember.create({
      household: household._id,
      user: req.user._id,
      role: 'partner',
      status: 'active',
      joinedAt: new Date(),
    });
    await User.updateOne({ _id: req.user._id }, { activeHousehold: household._id });
    await Household.updateOne({ _id: household._id }, { isPersonal: false });

    res.json(await shapeFamily(household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/family/leave ───────────────────────────────────────────────────
export const leaveFamily = async (req, res) => {
  try {
    if (!req.household || req.household.isPersonal) {
      return res.status(400).json({ message: 'לא שייך לקבוצה' });
    }

    const member = await HouseholdMember.findOne({
      household: req.household._id,
      user: req.user._id,
      status: 'active',
    });
    if (!member) return res.status(400).json({ message: 'לא שייך לקבוצה' });

    // Owner may only leave once no other active members remain
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

    const { ensurePersonalHousehold } = await import('../utils/ensureHousehold.js');
    const user = await User.findById(req.user._id).select('name').lean();
    const personal = await ensurePersonalHousehold(user || { _id: req.user._id });
    await User.updateOne({ _id: req.user._id }, { activeHousehold: personal._id });

    res.json({ message: 'עזבת את הקבוצה המשפחתית' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/family/name ─────────────────────────────────────────────────────
export const updateFamilyName = async (req, res) => {
  try {
    if (!req.household || req.household.isPersonal) {
      return res.status(400).json({ message: 'לא שייך לקבוצה' });
    }
    if (!['owner', 'partner'].includes(req.member?.role)) {
      return res.status(403).json({ message: 'אין הרשאה' });
    }
    await Household.updateOne({ _id: req.household._id }, { name: (req.body.name || '').trim() });
    res.json(await shapeFamily(req.household._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
