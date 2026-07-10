// הרכבת אפליקציית Express בלבד — חיבור DB והאזנה לפורט נמצאים ב-server.js
// (ההפרדה מאפשרת לטעון את האפליקציה בבדיקות בלי שרת חי)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';

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
import bankConnectionRoutes from './routes/bankConnectionRoutes.js';
import calRoutes from './routes/calRoutes.js';
import maaserRoutes from './routes/maaserRoutes.js';
import familyRoutes from './routes/familyRoutes.js';
import householdRoutes from './routes/householdRoutes.js';
import adminUsersRoutes from './routes/adminUsers.js';
import businessRoutes from './routes/businessRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';

// ייבוא מידלוור
import rateLimiter, { authLimiter, scrapeLimiter } from './middlewares/rateLimiter.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { requestLogger, errorHandler } from './middlewares/errorHandler.js';
import { csrfTokenHandler, csrfProtection } from './middlewares/csrf.js';
import { familyScope } from './middlewares/familyScope.js';
import logger from './utils/logger.js';
import loggingMiddleware from './middlewares/loggingMiddleware.js';

const app = express();

// nginx proxy — חובה לפני rate-limiter
app.set('trust proxy', 1);

// --- הגדרות אבטחה בסיסיות (Helmet) ---
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://connect.cal-online.co.il", "https://api.cal-online.co.il", "https://accounts.google.com"],
      frameSrc: ["https://accounts.google.com"],
    },
  },
}));
// --- הגדרות CORS (החלק הקריטי לתקשורת ברנדר) ---
const allowedOrigins = [
  'http://localhost:5173',                    // לפיתוח מקומי
  'http://localhost:3000',                    // לפיתוח חלופי
  process.env.CLIENT_URL,                     // כתובת לקוח מ-.env
  process.env.DEPLOYMENT_URL,                 // כתובת development/staging
].filter(Boolean); // הסר null/undefined values

app.use(cors({ 
  origin: function (origin, callback) {
    // מאפשר בקשות ללא origin (כמו Postman) או אם ה-origin ברשימה המותרת
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // חובה להעברת עוגיות
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token', 'X-Fina-Client',
    'X-Screen-Width', 'X-Screen-Height', 'X-Color-Depth', 'X-HW-Cores', 'X-HW-Memory',
    'X-Connection-Type', 'X-Connection-Downlink', 'X-Connection-RTT', 'X-Session-Id', 'X-Device-Info'],
}));

// --- הגדרות גודל גוף הבקשה ---
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use(cookieParser());
app.use(mongoSanitize());
app.use(requestLogger); // Request logging middleware
app.use(loggingMiddleware); // Visitor analytics logging

// --- Health check (לבדיקת תקינות השרת) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// --- נתיבים ציבוריים (ללא CSRF) ---
app.use('/api/auth', authLimiter, authRoutes);

// --- Endpoint לקבלת ה-CSRF Token ---
app.get('/api/csrf-token', rateLimiter, csrfTokenHandler);

// --- הפעלת הגנת CSRF על כל הנתיבים מכאן ומטה ---
app.use(csrfProtection);

// --- נתיבים מוגנים (דורשים התחברות) ---
app.use('/api/family',    requireAuth, familyRoutes);
app.use('/api/household', requireAuth, householdRoutes);
app.use('/api/dashboard', requireAuth, familyScope, dashboardRoutes);
app.use('/api/analytics',       requireAuth, familyScope, analyticsRoutes);
app.use('/api/projects',        requireAuth, projectRoutes);
app.use("/api/data",            requireAuth, familyScope, dataRoutes);
app.use(["/api/finance", "/api/finances"], requireAuth, familyScope, financeRoutes);
app.use('/api/transactions',    requireAuth, familyScope, transactionRoutes);
app.use('/api/categories',      requireAuth, familyScope, categoryRoutes);
app.use('/api/management',      requireAuth, managementRoutes);
app.use('/api/stocks',          requireAuth, familyScope, stockRoutes);
app.use('/api/deposits',        requireAuth, familyScope, depositRoutes);
app.use('/api/funds',           requireAuth, familyScope, fundRoutes);
app.use('/api/loans',           requireAuth, familyScope, loanRoutes);
app.use('/api/rates',           requireAuth, rateRoutes);
app.use('/api/suggestions',     requireAuth, familyScope, suggestionRoutes);
app.use('/api/budgets',         requireAuth, familyScope, budgetRoutes);
app.use('/api/recurring',       requireAuth, familyScope, recurringRoutes);
app.use('/api/pension',         requireAuth, familyScope, pensionRoutes);
app.use('/api/net-worth',       requireAuth, familyScope, netWorthRoutes);
app.use('/api/insurance',       requireAuth, familyScope, insuranceRoutes);
app.use('/api/mortgages',       requireAuth, familyScope, mortgageRoutes);
app.use('/api/goals',           requireAuth, familyScope, goalRoutes);
app.use('/api/alerts',          requireAuth, familyScope, alertRoutes);
app.use('/api/tax',             requireAuth, familyScope, taxRoutes);
app.use('/api/real-estate',     requireAuth, familyScope, realEstateRoutes);
app.use('/api/debts',           requireAuth, familyScope, debtRoutes);
app.use('/api/child-savings',   requireAuth, familyScope, childSavingsRoutes);
app.use('/api/foreign-currency',requireAuth, familyScope, foreignCurrencyRoutes);
app.use('/api/reports',         requireAuth, familyScope, reportRoutes);
app.use('/api/maaser',          requireAuth, familyScope, maaserRoutes);
app.use('/api/import',  requireAuth, scrapeLimiter, importRoutes);
app.use('/api/scrape',  requireAuth, scrapeLimiter, scraperRoutes);
app.use('/api/connections', requireAuth, familyScope, bankConnectionRoutes);
app.use('/api/cal',     scrapeLimiter, calRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/business',    requireAuth, familyScope, businessRoutes);
app.use('/api/account',       requireAuth, familyScope, accountRoutes);
app.use('/api/subscription',  requireAuth, familyScope, subscriptionRoutes);

// --- טיפול בשגיאות ---

// 404 - לא נמצא
app.use('*', (req, res) => {
  logger.warn('404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ message: 'API endpoint not found' });
});

// טיפול שגיאות גלובלי
app.use(errorHandler);

export default app;