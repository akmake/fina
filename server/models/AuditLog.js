import mongoose from 'mongoose';

/**
 * AuditLog — תיעוד append-only של פעולות רגישות.
 * אין עדכון ואין מחיקה של רשומות — רק כתיבה וקריאה (אדמין).
 */
const auditLogSchema = new mongoose.Schema({
  actor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action:   { type: String, required: true, index: true },   // 'transaction.delete', 'user.role.change' וכו'
  entity:   { type: String, required: true },                // שם המודל
  entityId: { type: mongoose.Schema.Types.ObjectId },
  before:   { type: mongoose.Schema.Types.Mixed },
  after:    { type: mongoose.Schema.Types.Mixed },
  ip:       { type: String },
}, {
  timestamps: { createdAt: 'at', updatedAt: false },
});

auditLogSchema.index({ at: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
