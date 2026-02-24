import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000,
  },
}, {
  timestamps: true,
});

const suggestionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  // סטטוס ההצעה — רק מנהל יכול לשנות
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'in-progress', 'done', 'rejected'],
    default: 'pending',
  },
  // תגובות (שרשרת שיחה)
  replies: [replySchema],
  
  // כמות upvotes
  votes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

suggestionSchema.index({ status: 1, createdAt: -1 });
suggestionSchema.index({ user: 1 });

export default mongoose.model('Suggestion', suggestionSchema);
