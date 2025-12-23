import FinanceProfile from '../models/FinanceProfile.js';

// @desc   קבלת הפרופיל הפיננסי של המשתמש המחובר
// @route  GET /api/finances
// @access Private
export const getFinanceProfile = async (req, res) => {
  try {
    // השתמשנו ב-req.user._id כדי למצוא את הפרופיל הנכון
    let profile = await FinanceProfile.findOne({ user: req.user._id });

    // אם למשתמש עדיין אין פרופיל, ניצור אובייקט זמני עם ערכי ברירת מחדל
    if (!profile) {
      profile = {
        user: req.user._id,
        checking: 0,
        cash: 0,
        deposits: 0,
        stocks: 0,
      };
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching finance profile:', error);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// @desc   עדכון (או יצירה) של הפרופיל הפיננסי
// @route  POST /api/finances
// @access Private
export const updateFinanceProfile = async (req, res) => {
  const { checking, cash, deposits, stocks } = req.body;

  const profileData = {
    user: req.user._id,
    checking: Number(checking) || 0,
    cash: Number(cash) || 0,
    deposits: Number(deposits) || 0,
    stocks: Number(stocks) || 0,
  };

  try {
    // findOneAndUpdate עם upsert:true יעדכן את הפרופיל אם הוא קיים, או ייצור אותו אם לא.
    const updatedProfile = await FinanceProfile.findOneAndUpdate(
      { user: req.user._id }, // תנאי החיפוש
      profileData,            // הנתונים לעדכון
      { new: true, upsert: true, setDefaultsOnInsert: true } // אפשרויות
    );

    res.json(updatedProfile);
  } catch (error) {
    console.error('Error updating finance profile:', error);
    res.status(500).json({ message: 'שגיאת שרת בעדכון הפרופיל' });
  }
};