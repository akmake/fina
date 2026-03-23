import Suggestion from '../models/Suggestion.js';
import User from '../models/User.js';

// פונקציית עזר — שולפת שם משתמש מה-DB
const getUserName = async (userId) => {
  const user = await User.findById(userId).select('name').lean();
  return user?.name || 'משתמש';
};

// @desc   קבלת כל ההצעות (משותף לכל המשתמשים)
// @route  GET /api/suggestions
export const getSuggestions = async (req, res) => {
  try {
    const suggestions = await Suggestion.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ message: 'שגיאה בשליפת ההצעות' });
  }
};

// @desc   יצירת הצעה חדשה
// @route  POST /api/suggestions
export const createSuggestion = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'נא למלא כותרת ותיאור' });
    }

    const userName = await getUserName(req.user._id);

    const suggestion = await Suggestion.create({
      user: req.user._id,
      userName,
      title: title.trim(),
      description: description.trim(),
    });

    res.status(201).json(suggestion);
  } catch (error) {
    console.error('Create suggestion error:', error);
    res.status(500).json({ message: 'שגיאה ביצירת ההצעה' });
  }
};

// @desc   עדכון סטטוס הצעה (מנהל בלבד)
// @route  PUT /api/suggestions/:id/status
export const updateSuggestionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'reviewed', 'in-progress', 'done', 'rejected'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'סטטוס לא חוקי' });
    }

    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({ message: 'ההצעה לא נמצאה' });
    }

    res.json(suggestion);
  } catch (error) {
    console.error('Update suggestion status error:', error);
    res.status(500).json({ message: 'שגיאה בעדכון הסטטוס' });
  }
};

// @desc   הוספת תגובה להצעה
// @route  POST /api/suggestions/:id/replies
export const addReply = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'נא לכתוב תגובה' });
    }

    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ message: 'ההצעה לא נמצאה' });
    }

    const userName = await getUserName(req.user._id);

    suggestion.replies.push({
      user: req.user._id,
      userName,
      role: req.user.role || 'user',
      text: text.trim(),
    });

    await suggestion.save();
    res.status(201).json(suggestion);
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'שגיאה בהוספת תגובה' });
  }
};

// @desc   הצבעה/ביטול הצבעה
// @route  POST /api/suggestions/:id/vote
export const toggleVote = async (req, res) => {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ message: 'ההצעה לא נמצאה' });
    }

    const userId = req.user._id.toString();
    const voteIndex = suggestion.votes.findIndex(v => v.toString() === userId);

    if (voteIndex > -1) {
      suggestion.votes.splice(voteIndex, 1); // ביטול הצבעה
    } else {
      suggestion.votes.push(req.user._id); // הצבעה
    }

    await suggestion.save();
    res.json(suggestion);
  } catch (error) {
    console.error('Toggle vote error:', error);
    res.status(500).json({ message: 'שגיאה בהצבעה' });
  }
};

// @desc   מחיקת הצעה (מנהל בלבד, או המשתמש שיצר)
// @route  DELETE /api/suggestions/:id
export const deleteSuggestion = async (req, res) => {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ message: 'ההצעה לא נמצאה' });
    }

    // רק מנהל או היוצר יכולים למחוק
    const isOwner = suggestion.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'אין הרשאה למחוק הצעה זו' });
    }

    await Suggestion.deleteOne({ _id: req.params.id });
    res.json({ message: 'ההצעה נמחקה בהצלחה' });
  } catch (error) {
    console.error('Delete suggestion error:', error);
    res.status(500).json({ message: 'שגיאה במחיקת ההצעה' });
  }
};
