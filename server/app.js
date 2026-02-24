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

// ייבוא מידלוור
import rateLimiter from './middlewares/rateLimiter.js';
import { requireAuth } from './middlewares/authMiddleware.js';
import { requestLogger, errorHandler } from './middlewares/errorHandler.js';
import { csrfTokenHandler, csrfProtection } from './middlewares/csrf.js';
import logger from './utils/logger.js';

// חיבור למסד הנתונים
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
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
  crossOriginResourcePolicy: false // מאפשר טעינת תמונות אם צריך
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
      console.log("Blocked by CORS:", origin); // לוג שיעזור לך להבין אם משהו נחסם
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // חובה להעברת עוגיות
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// --- הגדרות גודל גוף הבקשה ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cookieParser());
app.use(mongoSanitize());
app.use(requestLogger); // Request logging middleware

// --- Health check (לבדיקת תקינות השרת) ---
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

// --- נתיבים מוגנים (דורשים התחברות) ---
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use("/api/data", requireAuth, dataRoutes);
app.use(["/api/finance", "/api/finances"], requireAuth, financeRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/management', requireAuth, managementRoutes);
app.use('/api/stocks', requireAuth, stockRoutes);
app.use('/api/deposits', requireAuth, depositRoutes);
app.use('/api/funds', requireAuth, fundRoutes);
app.use('/api/loans', requireAuth, loanRoutes);
app.use('/api/rates', requireAuth, rateRoutes);
app.use('/api/suggestions', requireAuth, suggestionRoutes);

// --- טיפול בשגיאות ---

// 404 - לא נמצא
app.use('*', (req, res) => {
  logger.warn('404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ message: 'API endpoint not found' });
});

// טיפול שגיאות גלובלי
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

export default app;