import User from '../../models/User.js';

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
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: 'name email role' }
    );
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשרת' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    res.json({ message: 'המשתמש נמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאה בשרת' });
  }
};
