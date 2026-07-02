import 'dotenv/config';
import mongoose from 'mongoose';
import logger from './utils/logger.js';

// --- ולידציית משתני סביבה קריטיים (fail fast) ---
const REQUIRED_ENV = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const PLACEHOLDER_PATTERN = /change|placeholder|your-|secret-key|example/i;
for (const name of REQUIRED_ENV) {
  const value = process.env[name];
  if (!value) {
    logger.error(`Missing required env var: ${name} — server will not start`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && name !== 'MONGO_URI') {
    if (PLACEHOLDER_PATTERN.test(value) || value.length < 32) {
      logger.error(`Env var ${name} looks like a placeholder or is too short (<32 chars) — refusing to start in production`);
      process.exit(1);
    }
  }
}

// --- חיבור למסד הנתונים ---
try {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  logger.info(`MongoDB Connected: ${conn.connection.host}`);

  // Sync indexes (drops old unique indexes, creates partial ones that ignore soft-deleted docs)
  const Transaction = (await import('./models/Transaction.js')).default;
  await Transaction.syncIndexes();
  const Budget = (await import('./models/Budget.js')).default;
  await Budget.syncIndexes();
} catch (error) {
  logger.error(`MongoDB Connection Error: ${error.message}`);
  process.exit(1);
}

const { default: app } = await import('./app.js');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
