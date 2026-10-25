import User from '../../models/User.js';
import { audit } from '../../utils/audit.js';
import { sendEmail } from '../../services/emailService.js';
import { purgeBankAccess } from '../../services/accountService.js';

export const getAllUsers = async (req, res) => {
  try {
    const filter = {};
    if (['pending', 'approved', 'rejected'].includes(req.query.status)) {
      // Users created before approval existed have no field → they count as approved.
      filter.approvalStatus = req.query.status === 'approved'
        ? { $in: ['approved', null] }
        : req.query.status;
    }
    const users = await User.find(filter)
      .select('name email role createdAt loginAttempts lockUntil googleId approvalStatus approvalDecidedAt emailVerified')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשרת' });
  }
};

// PATCH /api/admin/users/:id/approval { decision: 'approve' | 'reject' }
export const decideApproval = async (req, res) => {
  try {
    const { decision } = req.body || {};
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'החלטה לא חוקית' });
    }
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'לא ניתן לשנות את סטטוס הגישה של עצמך' });
    }

    const user = await User.findById(req.params.id);
    if (!user || user.deletedAt) return res.status(404).json({ message: 'משתמש לא נמצא' });

    const before = user.approvalStatus || 'approved';
    const after = decision === 'approve' ? 'approved' : 'rejected';
    user.approvalStatus = after;
    user.approvalDecidedAt = new Date();
    user.approvalDecidedBy = req.user._id;
    // Rejecting an active user must end their existing sessions immediately.
    if (after === 'rejected') user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await audit(req, after === 'approved' ? 'user.access.approve' : 'user.access.reject', 'User', {
      entityId: user._id,
      before: { approvalStatus: before },
      after: { approvalStatus: after },
    });

    if (after === 'approved') {
      await sendEmail({
        to: user.email,
        subject: 'הגישה שלך ל-Fina אושרה',
        text: `שלום ${user.name}, בקשת הגישה שלך אושרה. אפשר להתחבר עכשיו.`,
      });
    }

    res.json({
      _id: user._id, name: user.name, email: user.email, role: user.role,
      approvalStatus: user.approvalStatus, approvalDecidedAt: user.approvalDecidedAt,
    });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשרת' });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'תפקיד לא חוקי' });
    }
    const before = await User.findById(req.params.id).select('role');
    if (!before) return res.status(404).json({ message: 'משתמש לא נמצא' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: 'name email role' }
    );
    await audit(req, 'user.role.change', 'User', {
      entityId: user._id,
      before: { role: before.role },
      after: { role: user.role },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשרת' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    // Don't leave the deleted user's bank secrets / phones behind (scheduler
    // also skips owners that no longer exist).
    await purgeBankAccess(user._id);
    await audit(req, 'user.delete', 'User', {
      entityId: user._id,
      before: { name: user.name, email: user.email, role: user.role },
    });
    res.json({ message: 'המשתמש נמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשרת' });
  }
};
