import mongoose from 'mongoose';

const categoryRuleSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  searchString: {
    type: String,
    required: true,
    trim: true,
  },
  matchType: {
    type: String,
    enum: ['contains', 'exact', 'starts_with'],
    default: 'contains',
  },
  // השם החדש שנרצה לתת לעסקה (נרמול שמות)
  newName: {
    type: String,
    trim: true,
  },
  // הקטגוריה שנרצה לשייך
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  }
}, { timestamps: true });

categoryRuleSchema.index({ user: 1, searchString: 1 }, { unique: true });

const CategoryRule = mongoose.model('CategoryRule', categoryRuleSchema);
export default CategoryRule;