// server/controllers/foreignCurrencyController.js
import ForeignCurrency from '../models/ForeignCurrency.js';

const CURRENCY_LABELS = {
  USD: 'דולר אמריקאי',
  EUR: 'אירו',
  GBP: 'לירה שטרלינג',
  CHF: 'פרנק שוויצרי',
  JPY: 'ין יפני',
  CAD: 'דולר קנדי',
  AUD: 'דולר אוסטרלי',
  BTC: 'ביטקוין',
  ETH: 'את׳ריום',
  OTHER: 'אחר',
};

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CHF: 'Fr', JPY: '¥',
  CAD: 'C$', AUD: 'A$', BTC: '₿', ETH: 'Ξ', OTHER: '',
};

// GET /api/foreign-currency
export const getForeignCurrencies = async (req, res) => {
  try {
    const holdings = await ForeignCurrency.find({ user: req.user._id, status: 'active' }).sort({ currency: 1 });

    // סיכום לפי מטבע
    const byCurrency = {};
    for (const h of holdings) {
      if (!byCurrency[h.currency]) {
        byCurrency[h.currency] = {
          currency: h.currency,
          label: CURRENCY_LABELS[h.currency] || h.currency,
          symbol: CURRENCY_SYMBOLS[h.currency] || '',
          totalInCurrency: 0,
          totalInILS: 0,
          holdings: [],
        };
      }
      byCurrency[h.currency].totalInCurrency += h.amountInCurrency;
      byCurrency[h.currency].totalInILS += h.amountInILS || 0;
      byCurrency[h.currency].holdings.push(h);
    }

    const totalValueILS = holdings.reduce((s, h) => s + (h.amountInILS || 0), 0);
    const totalProfitLoss = holdings.reduce((s, h) => s + (h.profitLoss || 0), 0);

    res.json({
      holdings,
      byCurrency: Object.values(byCurrency),
      summary: {
        totalValueILS,
        totalProfitLoss,
        holdingsCount: holdings.length,
        currenciesCount: Object.keys(byCurrency).length,
      },
      currencyLabels: CURRENCY_LABELS,
    });
  } catch (error) {
    console.error('Error fetching foreign currencies:', error);
    res.status(500).json({ message: 'שגיאה בטעינת מט"ח' });
  }
};

// POST /api/foreign-currency
export const addForeignCurrency = async (req, res) => {
  try {
    const body = { ...req.body, user: req.user._id };
    // חישוב שווי ב-ILS אם לא צוין
    if (!body.amountInILS && body.amountInCurrency && body.exchangeRate) {
      body.amountInILS = body.amountInCurrency * body.exchangeRate;
    }
    const holding = await ForeignCurrency.create(body);
    res.status(201).json(holding);
  } catch (error) {
    console.error('Error adding foreign currency:', error);
    res.status(500).json({ message: 'שגיאה בהוספת מט"ח' });
  }
};

// PUT /api/foreign-currency/:id
export const updateForeignCurrency = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.amountInCurrency && body.exchangeRate) {
      body.amountInILS = body.amountInCurrency * body.exchangeRate;
    }
    body.lastUpdated = new Date();

    const holding = await ForeignCurrency.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      body,
      { new: true, runValidators: true }
    );
    if (!holding) return res.status(404).json({ message: 'החזקה לא נמצאה' });
    res.json(holding);
  } catch (error) {
    console.error('Error updating foreign currency:', error);
    res.status(500).json({ message: 'שגיאה בעדכון מט"ח' });
  }
};

// DELETE /api/foreign-currency/:id
export const deleteForeignCurrency = async (req, res) => {
  try {
    const holding = await ForeignCurrency.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!holding) return res.status(404).json({ message: 'החזקה לא נמצאה' });
    res.json({ message: 'החזקה נמחקה' });
  } catch (error) {
    console.error('Error deleting foreign currency:', error);
    res.status(500).json({ message: 'שגיאה במחיקת מט"ח' });
  }
};
