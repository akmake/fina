// server/models/Account.js
import mongoose from 'mongoose';
import softDelete from '../utils/softDelete.js';

const accountSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:    { type: String, required: true },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

accountSchema.plugin(softDelete);

const Account = mongoose.model('Account', accountSchema);

export default Account;
export { Account };
