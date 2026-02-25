import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  loggingEnabled: { type: Boolean, default: true },
  // אפשר להוסיף כאן עוד הגדרות מערכת בעתיד
}, { timestamps: true });

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
