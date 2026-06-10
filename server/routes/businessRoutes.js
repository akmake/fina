import express from 'express';
import Transaction from '../models/Transaction.js';
import MerchantMap from '../models/MerchantMap.js';
import { scopeFilter } from '../utils/scopeFilter.js';

const router = express.Router();

// GET /api/business/summary
// Returns month-by-month totals + category breakdown for the current year
router.get('/summary', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const from = new Date(year, 0, 1);
    const to   = new Date(year, 11, 31, 23, 59, 59);

    const base = { ...scopeFilter(req), isBusiness: true, type: 'הוצאה', date: { $gte: from, $lte: to } };

    const [byMonth, byCategory] = await Promise.all([
      Transaction.aggregate([
        { $match: base },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        { $match: base },
        { $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        }},
        { $sort: { total: -1 } },
      ]),
    ]);

    const yearTotal = byMonth.reduce((s, m) => s + m.total, 0);
    res.json({ byMonth, byCategory, yearTotal, year });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// GET /api/business/month-expenses?year=YYYY&month=MM
// Returns ALL expenses for the month (business and non-business) — client filters
router.get('/month-expenses', async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;

    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);

    const transactions = await Transaction.find({
      ...scopeFilter(req),
      type: 'הוצאה',
      date: { $gte: from, $lte: to },
    }).sort({ date: -1 });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// PATCH /api/business/transactions/:id/toggle
router.patch('/transactions/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const tx = await Transaction.findOne({ _id: id, ...scopeFilter(req) });
    if (!tx) return res.status(404).json({ message: 'עסקה לא נמצאה' });

    tx.isBusiness = !tx.isBusiness;
    if (note !== undefined) tx.businessNote = note;
    await tx.save();

    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// GET /api/business/merchants
// Returns ALL merchants from transaction history with their isBusiness status
router.get('/merchants', async (req, res) => {
  try {
    // Aggregate all unique merchant names + totals from all-time transactions
    const agg = await Transaction.aggregate([
      { $match: { ...scopeFilter(req), type: 'הוצאה' } },
      { $group: {
        _id: '$description',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        lastDate: { $max: '$date' },
      }},
      { $sort: { total: -1 } },
    ]);

    // Get all MerchantMap entries that have isBusiness set
    const businessMap = await MerchantMap.find({}).select('originalName newName isBusiness').lean();
    const bizSet = new Map(businessMap.map(m => [m.originalName, m.isBusiness]));

    const result = agg.map(m => ({
      name: m._id,
      total: m.total,
      count: m.count,
      lastDate: m.lastDate,
      isBusiness: bizSet.get(m._id) === true,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// PATCH /api/business/merchants/toggle
// Body: { merchantName, isBusiness }
// Marks/unmarks a merchant as business and bulk-updates all matching transactions
router.patch('/merchants/toggle', async (req, res) => {
  try {
    const { merchantName, isBusiness } = req.body;
    if (!merchantName) return res.status(400).json({ message: 'שם עסק חסר' });

    const flag = Boolean(isBusiness);

    // Update or create merchant map entry
    await MerchantMap.findOneAndUpdate(
      { originalName: merchantName },
      { $set: { isBusiness: flag } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Bulk-update all matching transactions for this user/scope
    const descRegex = new RegExp(merchantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const result = await Transaction.updateMany(
      {
        ...scopeFilter(req),
        type: 'הוצאה',
        $or: [
          { description: descRegex },
          { rawDescription: descRegex },
        ],
      },
      { $set: { isBusiness: flag } }
    );

    res.json({ updated: result.modifiedCount, isBusiness: flag });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

export default router;
