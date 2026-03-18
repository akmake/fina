import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';

// ייבוא נתיבים
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import fundRoutes from './routes/fundRoutes.js';

import projectRoutes from './routes/projectRoutes.js';
import dataRoutes from "./routes/dataRoutes.js";
import financeRoutes from './routes/financeRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import importRoutes from './routes/importRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import managementRoutes from './routes/managementRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import depositRoutes from './routes/depositRoutes.js';
import loanRoutes from './routes/loanRoutes.js';
import rateRoutes from './routes/rateRoutes.js';
import suggestionRoutes from './routes/suggestionRoutes.js';
import logsRoutes from './routes/logsRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import recurringRoutes from './routes/recurringRoutes.js';
import pensionRoutes from './routes/pensionRoutes.js';
import netWorthRoutes from './routes/netWorthRoutes.js';
import insuranceRoutes from './routes/insuranceRoutes.js';
import mortgageRoutes from './routes/mortgageRoutes.js';
import goalRoutes from './routes/goalRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import taxRoutes from './routes/taxRoutes.js';
import realEstateRoutes from './routes/realEstateRoutes.js';
import debtRoutes from './routes/debtRoutes.js';
import childSavingsRoutes from './routes/childSavingsRoutes.js';
import foreignCurrencyRoutes from './routes/foreignCurrencyRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import scraperRoutes from './routes/scraperRoutes.js';
import calRoutes from './routes/calRoutes.js';
import maaserRoutes from './routes/maaserRoutes.js';
import familyRoutes from './routes/familyRoutes.js';

// ייבוא מידלוור
import rateLimiter from './middlewares/rateLimiter.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { requestLogger, errorHandler } from './middlewares/errorHandler.js';
import { csrfTokenHandler, csrfProtection } from './middlewares/csrf.js';
import { familyScope } from './middlewares/familyScope.js';
import logger from './utils/logger.js';
import loggingMiddleware from './middlewares/loggingMiddleware.js';

// חיבור למסד הנתונים
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Sync indexes (drops old unique index, creates new one with processedDate)
    const Transaction = (await import('./models/Transaction.js')).default;
    await Transaction.syncIndexes();
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};
// הפעלת החיבור
await connectDB();

const app = express();

// --- הגדרות אבטחה בסיסיות (Helmet) ---
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));

// --- הגדרות CORS (החלק הקריטי לתקשורת ברנדר) ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
  process.env.DEPLOYMENT_URL,
].filter(Boolean);

app.use(cors({ 
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token', 'X-Fina-Client',
    'X-Screen-Width', 'X-Screen-Height', 'X-Color-Depth', 'X-HW-Cores', 'X-HW-Memory',
    'X-Connection-Type', 'X-Connection-Downlink', 'X-Connection-RTT', 'X-Session-Id', 'X-Device-Info'],
}));

// --- הגדרות גודל גוף הבקשה ---
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(cookieParser());
app.use(mongoSanitize());
app.use(requestLogger);
app.use(loggingMiddleware);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// --- נתיבים ציבוריים (ללא CSRF) ---
app.use('/api/import', importRoutes); 
app.use('/api/auth', authRoutes);

// --- Endpoint לקבלת ה-CSRF Token ---
app.get('/api/csrf-token', rateLimiter, csrfTokenHandler);

// --- הפעלת הגנת CSRF על כל הנתיבים מכאן ומטה ---
app.use(csrfProtection);

// --- נתיבים מוגנים ---
app.use('/api/family',           requireAuth, familyRoutes);
app.use('/api/dashboard',        requireAuth, familyScope, dashboardRoutes);
app.use('/api/analytics',        requireAuth, familyScope, analyticsRoutes);
app.use('/api/projects',         requireAuth, projectRoutes);
app.use("/api/data",             requireAuth, familyScope, dataRoutes);
app.use(["/api/finance", "/api/finances"], requireAuth, familyScope, financeRoutes);
app.use('/api/transactions',     requireAuth, familyScope, transactionRoutes);
app.use('/api/categories',       requireAuth, familyScope, categoryRoutes);
app.use('/api/management',       requireAuth, managementRoutes);
app.use('/api/stocks',           requireAuth, familyScope, stockRoutes);
app.use('/api/deposits',         requireAuth, familyScope, depositRoutes);
app.use('/api/funds',            requireAuth, familyScope, fundRoutes);
app.use('/api/loans',            requireAuth, familyScope, loanRoutes);
app.use('/api/rates',            requireAuth, rateRoutes);
app.use('/api/suggestions',      requireAuth, familyScope, suggestionRoutes);
app.use('/api/budgets',          requireAuth, familyScope, budgetRoutes);
app.use('/api/recurring',        requireAuth, familyScope, recurringRoutes);
app.use('/api/pension',          requireAuth, familyScope, pensionRoutes);
app.use('/api/net-worth',        requireAuth, familyScope, netWorthRoutes);
app.use('/api/insurance',        requireAuth, familyScope, insuranceRoutes);
app.use('/api/mortgages',        requireAuth, familyScope, mortgageRoutes);
app.use('/api/goals',            requireAuth, familyScope, goalRoutes);
app.use('/api/alerts',           requireAuth, familyScope, alertRoutes);
app.use('/api/tax',              requireAuth, familyScope, taxRoutes);
app.use('/api/real-estate',      requireAuth, familyScope, realEstateRoutes);
app.use('/api/debts',            requireAuth, familyScope, debtRoutes);
app.use('/api/child-savings',    requireAuth, familyScope, childSavingsRoutes);
app.use('/api/foreign-currency', requireAuth, familyScope, foreignCurrencyRoutes);
app.use('/api/reports',          requireAuth, familyScope, reportRoutes);
app.use('/api/maaser',           requireAuth, familyScope, maaserRoutes);
app.use('/api/scrape', scraperRoutes);
app.use('/api/cal',    calRoutes);
app.use('/api/logs',   logsRoutes);

// --- טיפול בשגיאות ---
app.use('*', (req, res) => {
  logger.warn('404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ message: 'API endpoint not found' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

export default app;