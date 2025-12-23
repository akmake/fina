import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import csurf from 'csurf';
import dashboardRoutes from './routes/dashboardRoutes.js';
import fundRoutes from './routes/fundRoutes.js'; // הוסף ייבוא

import authRoutes from './routes/auth.js';
import tzitzitRoutes from './routes/tzitzitCreate.js';
import projectRoutes from './routes/projectRoutes.js';
import { requireAuth } from './middlewares/authMiddleware.js';

import dataRoutes from "./routes/dataRoutes.js";
import financeRoutes from './routes/financeRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import importRoutes from './routes/importRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import managementRoutes from './routes/managementRoutes.js';
import rateLimiter from './middlewares/rateLimiter.js';
import stockRoutes from './routes/stockRoutes.js';
import depositRoutes from './routes/depositRoutes.js';
import loanRoutes from './routes/loanRoutes.js'; // 1. הוסף את השורה הזו
import rateRoutes from './routes/rateRoutes.js'; // הוסף ייבוא

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ Mongo connected');
} catch (err) {
  console.error('Mongo connection error:', err);
  process.exit(1);
}

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(mongoSanitize());

const csrfProtection = csurf({
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' },
});

// מסלולים שלא דורשים CSRF
app.use('/api/import', importRoutes);
app.use('/api/auth', authRoutes);

// נתיב לקבלת טוקן CSRF
app.get('/api/csrf-token', rateLimiter, csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.cookie('XSRF-TOKEN', token, { httpOnly: false, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ csrfToken: token });
});

// הפעלת הגנת CSRF על כל מה שיבוא אחרי
app.use(csrfProtection);

// שאר הראוטים
app.use('/api/tzitzit', tzitzitRoutes);
app.use('/api/projects', requireAuth, projectRoutes); // ✅ הוסרה השורה הכפולה
app.use("/api/data", dataRoutes);
app.use(["/api/finance", "/api/finances"], financeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stocks', requireAuth, stockRoutes); // הגנה על כל נתיבי המניות
app.use('/api/deposits', requireAuth, depositRoutes);
app.use('/api/funds', requireAuth, fundRoutes); // הוסף נתיב
app.use('/api/loans', loanRoutes); // 2. הוסף את השורה הזו. requireAuth כבר מופעל בתוך הראוטר
app.use('/api/rates', rateRoutes); // הוסף את השורה הזו


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✔ Server is booming on port ${PORT}`));

export default app;
