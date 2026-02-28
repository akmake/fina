import mongoose from 'mongoose';

const merchantMapSchema = new mongoose.Schema({
  // הסרנו את שדה המשתמש
  originalName: {
    type: String,
    required: true,
    trim: true,
    unique: true, // השם המקורי חייב להיות ייחודי בכל המערכת
  },
  newName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,
  },
  categoryName: {
    type: String,
    trim: true,
    required: false,
  },
}, {
  timestamps: true,
});

export default mongoose.model('MerchantMap', merchantMapSchema);