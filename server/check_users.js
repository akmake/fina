import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fina');
  const users = await mongoose.connection.db.collection('users').find().toArray();
  console.log(users);
  process.exit(0);
}
check();