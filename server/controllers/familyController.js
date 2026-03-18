import FamilyGroup from '../models/FamilyGroup.js';
import User from '../models/User.js';

// ── GET /api/family ──────────────────────────────────────────
export const getFamily = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('familyGroup').lean();
    if (!user?.familyGroup) return res.json(null);

    const group = await FamilyGroup.findById(user.familyGroup)
      .populate('members', 'name email avatar')
      .populate('createdBy', 'name email')
      .lean();

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/family/create ──────────────────────────────────
export const createFamily = async (req, res) => {
  try {
    const existing = await User.findById(req.user._id).select('familyGroup').lean();
    if (existing?.familyGroup) {
      return res.status(400).json({ message: 'כבר שייך לקבוצה משפחתית' });
    }

    const group = await FamilyGroup.create({
      name:      req.body.name || 'המשפחה שלנו',
      createdBy: req.user._id,
      members:   [req.user._id],
    });

    await User.findByIdAndUpdate(req.user._id, { familyGroup: group._id });

    const populated = await FamilyGroup.findById(group._id)
      .populate('members', 'name email avatar')
      .populate('createdBy', 'name email')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/family/join ────────────────────────────────────
export const joinFamily = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ message: 'קוד הזמנה חסר' });

    const existing = await User.findById(req.user._id).select('familyGroup').lean();
    if (existing?.familyGroup) {
      return res.status(400).json({ message: 'כבר שייך לקבוצה משפחתית' });
    }

    const group = await FamilyGroup.findOne({ inviteCode: inviteCode.toUpperCase().trim() });
    if (!group) return res.status(404).json({ message: 'קוד הזמנה לא תקין' });

    if (group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'כבר חבר בקבוצה' });
    }

    group.members.push(req.user._id);
    await group.save();
    await User.findByIdAndUpdate(req.user._id, { familyGroup: group._id });

    const populated = await FamilyGroup.findById(group._id)
      .populate('members', 'name email avatar')
      .populate('createdBy', 'name email')
      .lean();

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/family/leave ───────────────────────────────────
export const leaveFamily = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('familyGroup').lean();
    if (!user?.familyGroup) return res.status(400).json({ message: 'לא שייך לקבוצה' });

    const group = await FamilyGroup.findById(user.familyGroup);
    if (!group) return res.status(404).json({ message: 'קבוצה לא נמצאה' });

    group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
    await User.findByIdAndUpdate(req.user._id, { familyGroup: null });

    // אם אין עוד חברים — מחק את הקבוצה
    if (group.members.length === 0) {
      await FamilyGroup.findByIdAndDelete(group._id);
    } else {
      // אם היוצר עוזב — העבר בעלות לחבר הבא
      if (group.createdBy.toString() === req.user._id.toString()) {
        group.createdBy = group.members[0];
      }
      await group.save();
    }

    res.json({ message: 'עזבת את הקבוצה המשפחתית' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/family/name ─────────────────────────────────────
export const updateFamilyName = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('familyGroup').lean();
    if (!user?.familyGroup) return res.status(400).json({ message: 'לא שייך לקבוצה' });

    const group = await FamilyGroup.findByIdAndUpdate(
      user.familyGroup,
      { name: req.body.name },
      { new: true }
    ).populate('members', 'name email avatar').populate('createdBy', 'name email').lean();

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
