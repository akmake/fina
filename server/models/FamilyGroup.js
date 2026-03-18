import mongoose from 'mongoose';
import crypto from 'crypto';

const FamilyGroupSchema = new mongoose.Schema({
  name:       { type: String, default: 'המשפחה שלנו' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  inviteCode: { type: String, unique: true },
}, { timestamps: true });

FamilyGroupSchema.pre('save', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9B2C1"
  }
  next();
});

export default mongoose.model('FamilyGroup', FamilyGroupSchema);
