import User from '../../models/User.js';
import { audit } from '../../utils/audit.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('name email role createdAt loginAttempts lockUntil googleId')
      .sort({ createdAt: -1 });
    res.json(users);
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
    await audit(req, 'user.delete', 'User', {
      entityId: user._id,
      before: { name: user.name, email: user.email, role: user.role },
    });
    res.json({ message: 'המשתמש נמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשרת' });
  }
};
