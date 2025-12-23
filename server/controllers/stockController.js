// server/controllers/stockController.js

import yahooFinance from 'yahoo-finance2';
import Stock from '../models/Stock.js';
import Account from '../models/Account.js'; // Assuming you have this model from finance part
import AppError from '../utils/AppError.js';

const USD_TO_SHEKEL = 3.7; // Consider making this a dynamic value

// Helper to fetch price for a single ticker
const fetchPrice = async (ticker) => {
  try {
    const result = await yahooFinance.quote(ticker);
    return result?.regularMarketPrice ?? 0;
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker}:`, error);
    return 0;
  }
};

/** GET /api/stocks - Get all stocks for a user */
export const getAllStocks = async (req, res, next) => {
  try {
    const stocks = await Stock.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(stocks);
  } catch (err) {
    next(new AppError('Failed to fetch stocks.', 500));
  }
};

/** POST /api/stocks - Add a new stock */
export const addStock = async (req, res, next) => {
  const { ticker, purchasePrice, investedAmount, sourceAccountName } = req.body;

  if (!ticker || !purchasePrice || !investedAmount) {
    return next(new AppError('Ticker, purchase price, and invested amount are required.', 400));
  }

  try {
    const currentPrice = await fetchPrice(ticker);
    if (currentPrice === 0) {
        console.warn(`Could not fetch initial price for ${ticker}. It will be updated later.`);
    }

    const newStock = await Stock.create({
      user: req.user.id,
      ticker: ticker.toUpperCase(),
      purchasePrice,
      investedAmount,
      currentPrice,
      lastUpdated: new Date(),
    });

    // Optional: Deduct from an account if provided
    if (sourceAccountName && sourceAccountName !== "ללא הורדה") {
        const account = await Account.findOne({ userId: req.user.id, name: sourceAccountName });
        if (account) {
            const costILS = investedAmount * USD_TO_SHEKEL;
            account.balance -= costILS;
            await account.save();
        }
    }

    res.status(201).json(newStock);
  } catch (err) {
    next(new AppError('Failed to add stock.', 500));
  }
};

/** DELETE /api/stocks/:id - Delete a stock */
export const deleteStock = async (req, res, next) => {
    try {
        const stock = await Stock.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!stock) {
            return next(new AppError('Stock not found or user not authorized.', 404));
        }
        res.status(204).send();
    } catch (err) {
        next(new AppError('Failed to delete stock.', 500));
    }
};

/** POST /api/stocks/:id/sell - Sell a stock */
export const sellStock = async (req, res, next) => {
    try {
        const stock = await Stock.findOne({ _id: req.params.id, user: req.user.id });
        if (!stock) {
            return next(new AppError('Stock not found or user not authorized.', 404));
        }

        const valueILS = stock.currentValueILS;

        // Assuming a default 'checking' account exists
        const account = await Account.findOneAndUpdate(
            { userId: req.user.id, name: 'עו"ש' },
            { $inc: { balance: valueILS } },
            { new: true, upsert: true }
        );

        await stock.deleteOne();

        res.json({ message: `Sold ${stock.ticker}. ₪${valueILS.toFixed(2)} was deposited to ${account.name}.` });
    } catch (err) {
        next(new AppError('Failed to sell stock.', 500));
    }
};

/** POST /api/stocks/refresh-prices - Refresh all stock prices */
export const refreshPrices = async (req, res, next) => {
    try {
        const stocks = await Stock.find({ user: req.user.id });
        let updatedCount = 0;

        const promises = stocks.map(async (stock) => {
            const newPrice = await fetchPrice(stock.ticker);
            if (newPrice > 0 && newPrice !== stock.currentPrice) {
                stock.currentPrice = newPrice;
                stock.lastUpdated = new Date();
                await stock.save();
                updatedCount++;
            }
        });

        await Promise.all(promises);

        const updatedStocks = await Stock.find({ user: req.user.id }).sort({ createdAt: -1 });

        res.json({
            message: `${updatedCount} stock prices updated.`,
            stocks: updatedStocks,
        });
    } catch (err) {
        next(new AppError('Failed to refresh stock prices.', 500));
    }
};