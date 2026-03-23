import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

// טען את .env מהשורש של server
dotenv.config({ path: './.env', override: true });

console.log('🔐 Connecting to:', process.env.MONGO_URI);

const promoteToAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node scripts/makeAdmin.js <email>');
    process.exit(1);
  }

  const user = await User.findOne({ email });
  if (!user) {
    console.log('❌ המשתמש לא נמצא');
    process.exit(1);
  }

  await User.updateOne({ email }, { role: 'admin' });

  console.log(`✅ המשתמש ${email} קודם לתפקיד מנהל`);
  process.exit(0);
};

promoteToAdmin();
