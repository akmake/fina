// server/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

/* ▼ החלק החשוב – שימוש ב-mongoose.models לפני יצירה חדשה */
const User =
  mongoose.models.User || mongoose.model('User', userSchema);

export default User;                   // ES-Modules
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') module.exports = User; // CommonJS fallback
