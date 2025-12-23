import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    // מתירים את כל האפשרויות כדי למנוע קריסות
    enum: ['הוצאה', 'הכנסה', 'כללי', 'expense', 'income', 'general'],
    default: 'הוצאה',
    // Setter לתרגום אוטומטי
    set: (v) => {
        const map = {
            'expense': 'הוצאה',
            'income': 'הכנסה',
            'general': 'כללי'
        };
        return map[v] || v;
    }
  },
  color: {
    type: String,
    default: '#64748b'
  }
}, {
  timestamps: true,
});

// האינדקס הנכון: ייחודיות לפי משתמש + שם (כלומר: למשה ולדוד מותר שתהיה קטגוריה "צדקה" בנפרד)
categorySchema.index({ user: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

// --- התיקון הקריטי ---
// הקוד הזה ירוץ כשהשרת עולה וינסה למחוק את האינדקס הישן ('name_1') שגורם לכל הצרות.
// אם הוא כבר נמחק, הוא פשוט יתעלם מהשגיאה.
Category.collection.dropIndex('name_1')
  .then(() => console.log("FIXED: Old conflicting index 'name_1' was dropped successfully."))
  .catch((err) => {
    // אם האינדקס לא קיים (כי כבר מחקנו אותו), זה מצוין, ממשיכים הלאה.
    if (err.codeName !== 'IndexNotFound') {
        console.log("Note: Attempted to drop old index, result:", err.message);
    }
  });

export default Category;