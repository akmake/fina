import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import csurf from 'csurf';
import mongoose from 'mongoose';

// ייבוא נתיבים
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import fundRoutes from './routes/fundRoutes.js';
import tzitzitRoutes from './routes/tzitzitCreate.js';
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

// ייבוא מידלוור
import rateLimiter from './middlewares/rateLimiter.js';
import { requireAuth } from './middlewares/authMiddleware.js';

// חיבור למסד הנתונים
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✔ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};
// הפעלת החיבור
await connectDB();

const app = express();

// --- הגדרות אבטחה בסיסיות ---
app.use(helmet({ 
  crossOriginResourcePolicy: false // מאפשר טעינת תמונות אם צריך
}));

app.use(cors({ 
  origin: process.env.CLIENT_URL || 'http://localhost:5173', 
  credentials: true 
}));

// 💥 תיקון קריטי: הגדלת מגבלת הגודל למניעת שגיאות בייבוא קבצים (413 Payload Too Large) 💥
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cookieParser());
app.use(mongoSanitize());

// --- הגדרת CSRF ---
const csrfProtection = csurf({
  cookie: { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: 'strict' 
  },
});

// --- נתיבים ציבוריים (ללא CSRF בהכרח, או מוחרגים) ---
app.use('/api/import', importRoutes);
app.use('/api/auth', authRoutes);

// Endpoint לקבלת ה-CSRF Token
// הוספתי כאן את rateLimiter כפי שהיה במקור כדי להגן על הנתיב הזה
app.get('/api/csrf-token', rateLimiter, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// --- הפעלת הגנת CSRF על כל הנתיבים מכאן ומטה ---
app.use(csrfProtection);

// --- נתיבים מוגנים ---
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/tzitzit', requireAuth, tzitzitRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use("/api/data", requireAuth, dataRoutes);
app.use(["/api/finance", "/api/finances"], requireAuth, financeRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/management', requireAuth, managementRoutes);
app.use('/api/stocks', requireAuth, stockRoutes);
app.use('/api/deposits', requireAuth, depositRoutes);
app.use('/api/funds', requireAuth, fundRoutes);
app.use('/api/loans', requireAuth, loanRoutes); // הוספתי requireAuth ליתר ביטחון
app.use('/api/rates', requireAuth, rateRoutes);

// טיפול בשגיאות 404
app.use('*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// טיפול בשגיאות גלובלי (Error Handler)
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Form has been tampered with (CSRF Invalid)' });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;