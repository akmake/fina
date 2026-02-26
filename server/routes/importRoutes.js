// server/routes/importRoutes.js

import express from 'express';
import { uploadAndParse, processTransactions, checkMerchants } from '../controllers/importController.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = express.Router();

// כל הנתיבים בראוטר זה דורשים אימות
router.use(requireAuth);

// נתיב חדש לשלב הראשון: העלאה ופענוח
router.post('/upload', uploadAndParse);
router.post('/check-merchants', checkMerchants);

// נתיב קיים לשלב השני: עיבוד סופי ושמירה
router.post('/process-transactions', processTransactions);

export default router;