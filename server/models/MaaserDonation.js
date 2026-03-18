import mongoose from 'mongoose';

const MaaserDonationSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:        { type: Number, required: true, min: 0 },
  date:          { type: Date, required: true, default: Date.now },
  recipient:     { type: String, default: '' },
  notes:         { type: String, default: '' },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
}, { timestamps: true });

export default mongoose.model('MaaserDonation', MaaserDonationSchema);
