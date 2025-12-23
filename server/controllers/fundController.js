import Fund from '../models/Fund.js';
import Account from '../models/Account.js';
import { getFundPriceBizportal } from '../utils/fundScraper.js';

// GET /api/funds - קבלת כל הקרנות של המשתמש
export const getFunds = async (req, res, next) => {
  try {
    const funds = await Fund.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(funds);
  } catch (error) {
    next(error);
  }
};

// POST /api/funds - הוספת קרן חדשה
export const addFund = async (req, res, next) => {
  try {
    const { fund_number, purchase_price_agorot, invested_amount, sourceAccount } = req.body;

    // ולידציה בסיסית של הקלט
    if (!fund_number || purchase_price_agorot === undefined || invested_amount === undefined) {
      return res.status(400).json({ message: 'שדות חובה חסרים: מספר קרן, מחיר קנייה וסכום השקעה.' });
    }
    
    const purchase_price = parseFloat(purchase_price_agorot) / 100.0;
    
    if (isNaN(purchase_price)) {
      return res.status(400).json({ message: 'מחיר הקנייה שהוזן אינו מספר תקין.' });
    }

    const current_price = await getFundPriceBizportal(fund_number);

    // הורדה מחשבון מקור (אם הוגדר)
    if (sourceAccount && sourceAccount !== "ללא הורדה") {
      await Account.findOneAndUpdate(
        { userId: req.user.id, name: sourceAccount },
        { $inc: { balance: -parseFloat(invested_amount) } }
      );
    }

    // בניית האובייקט באופן מפורש במקום שימוש ב-...req.body
    const newFund = await Fund.create({
      user: req.user.id,
      fund_number,
      purchase_price,
      invested_amount: parseFloat(invested_amount),
      current_price,
      last_updated: new Date()
    });

    res.status(201).json(newFund);

  } catch (error) {
    // העברת השגיאה ל-middleware הכללי לטיפול בשגיאות
    next(error);
  }
};

// POST /api/funds/refresh - רענון כל המחירים
export const refreshAllPrices = async (req, res, next) => {
  try {
    const funds = await Fund.find({ user: req.user.id });
    for (const fund of funds) {
      const price = await getFundPriceBizportal(fund.fund_number);
      if (price > 0) {
        fund.current_price = price;
        fund.last_updated = new Date();
        await fund.save();
      }
    }
    const updatedFunds = await Fund.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(updatedFunds);
  } catch(error) {
    next(error);
  }
};

// POST /api/funds/:id/sell - "מכירה" של קרן
export const sellFund = async (req, res, next) => {
  try {
    const fund = await Fund.findById(req.params.id);
    if (!fund || String(fund.user) !== req.user.id) {
      return res.status(404).json({ message: 'Fund not found' });
    }

    const value = fund.current_value;
    await Account.findOneAndUpdate(
        { userId: req.user.id, name: 'עו"ש' }, 
        { $inc: { balance: value } }, 
        { upsert: true }
    );
    
    await fund.deleteOne();
    res.json({ message: `Fund ${fund.fund_number} sold. ${value.toFixed(2)} ILS added to checking account.` });
  } catch(error) {
    next(error);
  }
};

// DELETE /api/funds/:id - מחיקת קרן
export const deleteFund = async (req, res, next) => {
  try {
    const fund = await Fund.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!fund) {
        return res.status(404).json({ message: 'Fund not found' });
    }
    res.status(204).send();
  } catch(error) {
    next(error);
  }
};