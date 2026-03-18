import MaaserSettings from '../models/MaaserSettings.js';
import MaaserDonation from '../models/MaaserDonation.js';
import Transaction    from '../models/Transaction.js';
import { scopeFilter } from '../utils/scopeFilter.js';

// ── פונקציה פנימית: קבל או צור הגדרות ──────────────────────
const getOrCreateSettings = async (userId) => {
  let settings = await MaaserSettings.findOne({ user: userId });
  if (!settings) settings = await MaaserSettings.create({ user: userId });
  return settings;
};

// ── GET /api/maaser/settings ─────────────────────────────────
export const getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user._id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── PUT /api/maaser/settings ─────────────────────────────────
export const updateSettings = async (req, res) => {
  try {
    const { percentage, startDate, donationCategories } = req.body;
    const settings = await getOrCreateSettings(req.user._id);

    if (percentage !== undefined)        settings.percentage         = percentage;
    if (startDate  !== undefined)        settings.startDate          = startDate || null;
    if (donationCategories !== undefined) settings.donationCategories = donationCategories;

    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/maaser/summary ──────────────────────────────────
export const getSummary = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user._id);

    // תאריך התחלה: אם לא הוגדר — מהעסקה הראשונה
    let fromDate = settings.startDate;
    if (!fromDate) {
      const first = await Transaction.findOne({
        ...scopeFilter(req),
        type:     'הכנסה',
        category: 'משכורת',
      }).sort({ date: 1 });
      fromDate = first?.date || new Date();
    }

    // קטגוריות הכנסה שחייבות במעשרות
    const incCats = settings.incomeCategories?.length
      ? settings.incomeCategories
      : ['משכורת'];

    // סך הכנסות מהקטגוריות הנבחרות מתאריך ההתחלה
    const incomeAgg = await Transaction.aggregate([
      {
        $match: {
          ...scopeFilter(req),
          type:     'הכנסה',
          category: { $in: incCats },
          date:     { $gte: new Date(fromDate) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalIncome = incomeAgg[0]?.total || 0;

    // סכום נדרש
    const required = Math.round(totalIncome * settings.percentage) / 100;

    // סך תרומות
    const donAgg = await MaaserDonation.aggregate([
      { $match: { ...scopeFilter(req) } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalDonated = donAgg[0]?.total || 0;

    const balance = required - totalDonated;

    res.json({
      totalIncome,
      percentage: settings.percentage,
      required,
      totalDonated,
      balance,
      fromDate,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/maaser/donations ────────────────────────────────
export const getDonations = async (req, res) => {
  try {
    const donations = await MaaserDonation
      .find(scopeFilter(req))
      .sort({ date: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/maaser/donations ───────────────────────────────
export const addDonation = async (req, res) => {
  try {
    const { amount, date, recipient, notes, transactionId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'סכום לא תקין' });

    const donation = await MaaserDonation.create({
      user: req.user._id,
      amount,
      date: date || new Date(),
      recipient: recipient || '',
      notes:     notes     || '',
      transactionId: transactionId || null,
    });
    res.status(201).json(donation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/maaser/income-categories ───────────────────────
// מחזיר את כל קטגוריות ההכנסה הקיימות בעסקאות המשתמש
export const getIncomeCategories = async (req, res) => {
  try {
    const cats = await Transaction.distinct('category', {
      ...scopeFilter(req),
      type: 'הכנסה',
    });
    res.json(cats.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/maaser/donations/:id ────────────────────────
export const deleteDonation = async (req, res) => {
  try {
    const donation = await MaaserDonation.findOneAndDelete({
      _id:  req.params.id,
      user: req.user._id,
    });
    if (!donation) return res.status(404).json({ message: 'לא נמצא' });
    res.json({ message: 'נמחק' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
