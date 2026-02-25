// server/models/Pension.js
import mongoose from 'mongoose';

// מסלול חיסכון פנסיוני
const pensionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // סוג המוצר
  productType: { 
    type: String, 
    required: true,
    enum: [
      'pension',              // קרן פנסיה
      'education_fund',       // קרן השתלמות
      'provident_fund',       // קופת גמל
      'managers_insurance',   // ביטוח מנהלים
      'savings_policy',       // פוליסת חיסכון
    ]
  },
  
  // פרטי המוצר
  name: { type: String, required: true, trim: true },          // שם הקרן/חברה
  policyNumber: { type: String, trim: true },                   // מספר פוליסה
  company: { type: String, trim: true },                        // חברה מנהלת (מגדל, הראל, כלל...)
  track: { type: String, trim: true },                          // מסלול (כללי, מניות, אג"ח...)
  
  // הפקדות
  monthlyEmployeeContribution: { type: Number, default: 0, min: 0 },   // הפקדת עובד
  monthlyEmployerContribution: { type: Number, default: 0, min: 0 },   // הפקדת מעסיק
  monthlySeveranceContribution: { type: Number, default: 0, min: 0 },  // פיצויים (מעסיק)
  
  // יתרות
  currentBalance: { type: Number, default: 0, min: 0 },        // יתרה נוכחית
  totalDeposited: { type: Number, default: 0, min: 0 },        // סה"כ הופקד
  
  // תשואה
  lastYearReturn: { type: Number, default: 0 },                 // תשואה שנתית אחרונה (%)
  totalReturn: { type: Number, default: 0 },                    // תשואה מצטברת (%)
  
  // דמי ניהול
  managementFeeDeposits: { type: Number, default: 0, min: 0 },  // דמי ניהול מהפקדות (%)
  managementFeeBalance: { type: Number, default: 0, min: 0 },   // דמי ניהול מצבירה (%)
  
  // תאריכים
  startDate: { type: Date, required: true },
  maturityDate: { type: Date },                                  // תאריך פדיון (לקרן השתלמות - 6 שנים)
  
  // סטטוס
  status: { 
    type: String, 
    enum: ['active', 'frozen', 'redeemed', 'transferred'], 
    default: 'active' 
  },
  
  // מוטבים (לפנסיה/ביטוח)
  beneficiaries: [{
    name: { type: String, trim: true },
    relation: { type: String, trim: true },
    percentage: { type: Number, min: 0, max: 100 },
  }],
  
  // שכר ברוטו (לחישוב אחוזי הפרשה)
  grossSalary: { type: Number, min: 0 },
  
  notes: { type: String, maxlength: 500, trim: true },
  lastUpdated: { type: Date, default: Date.now },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// סה"כ הפקדה חודשית
pensionSchema.virtual('totalMonthlyContribution').get(function() {
  return this.monthlyEmployeeContribution + 
         this.monthlyEmployerContribution + 
         this.monthlySeveranceContribution;
});

// סה"כ הפקדה שנתית
pensionSchema.virtual('totalAnnualContribution').get(function() {
  return this.totalMonthlyContribution * 12;
});

// רווח/הפסד
pensionSchema.virtual('profitLoss').get(function() {
  return this.currentBalance - this.totalDeposited;
});

// עלות דמי ניהול שנתית משוערת
pensionSchema.virtual('annualManagementCost').get(function() {
  const fromBalance = this.currentBalance * (this.managementFeeBalance / 100);
  const fromDeposits = this.totalMonthlyContribution * 12 * (this.managementFeeDeposits / 100);
  return fromBalance + fromDeposits;
});

pensionSchema.index({ user: 1, productType: 1 });
pensionSchema.index({ user: 1, status: 1 });

export default mongoose.model('Pension', pensionSchema);
