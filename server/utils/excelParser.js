import MerchantMap from '../models/MerchantMap.js';
import CategoryRule from '../models/CategoryRule.js';

function parseDate(dateInput) {
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) return dateInput;
  if (!dateInput) return null;

  const dateStr = String(dateInput).trim();
  const parts = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) return date;
    }
  }

  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

const createTransactionObject = (row, userId, type) => {
    // פונקציית עזר למציאת ערך לפי רשימת מפתחות אפשריים
    const getValue = (keys) => {
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                return row[key];
            }
        }
        return null;
    };

    const date = parseDate(getValue(['תאריך עסקה', 'תאריך', 'Date', 'date']));
    const description = getValue(['שם בית העסק', 'שם בית עסק', 'תיאור', 'Description', 'description']);
    
    if (!date || !description) return null;

    let amount, transactionType;
    if (type === 'max') {
        const chargeAmountStr = String(getValue(['סכום חיוב', 'סכום לתשלום', 'Amount', 'amount']) || '0').replace(/,/g, '');
        const creditAmountStr = String(getValue(['סכום זיכוי', 'זיכוי']) || '0').replace(/,/g, '');
        
        const chargeAmount = parseFloat(chargeAmountStr);
        const creditAmount = parseFloat(creditAmountStr);

        if (!isNaN(chargeAmount) && chargeAmount !== 0) {
            amount = Math.abs(chargeAmount);
            transactionType = chargeAmount > 0 ? 'הוצאה' : 'הכנסה';
        } else if (!isNaN(creditAmount) && creditAmount !== 0) {
            amount = Math.abs(creditAmount);
            transactionType = 'הכנסה';
        } else {
            return null;
        }
    } else { // 'cal'
        const amountValue = getValue(["סכום בש\"ח", "סכום עסקה", "סכום חיוב"]);
        if (amountValue == null) return null;
        amount = parseFloat(String(amountValue).replace(/,/g, ''));
        if (isNaN(amount)) return null;
        transactionType = amount < 0 ? 'הכנסה' : 'הוצאה';
        amount = Math.abs(amount);
    }

    // קריאת הקטגוריה מהקובץ (תומך גם ב"שם ענף" וגם ב"קטגוריה" כמו בקובץ ששלחת)
    const rawCategory = getValue([
        'קטגוריה', 
        'שם קטגוריה', 
        'Category', 
        'שם ענף',      
        'תיאור ענף',   
        'ענף'
    ]) || 'כללי';

    return {
        user: userId,
        date,
        description: description,
        rawDescription: description,
        amount,
        type: transactionType,
        account: 'checking',
        category: String(rawCategory).trim(),
    };
};

export async function parseTransactions(cleanedData, fileType, userId) {
    const mapper = (row) => createTransactionObject(row, userId, fileType);
    const initialTransactions = cleanedData.map(mapper).filter(Boolean);

    const [merchantMaps, categoryRules] = await Promise.all([
        MerchantMap.find({}).populate('category').lean(),
        CategoryRule.find({}).populate('category').lean(),
    ]);

    const merchantMapCache = new Map(merchantMaps.map(m => [m.originalName, m]));
    const merchantsThatNeedMapping = new Set();

    const transactions = initialTransactions.map(trx => {
        let finalDescription = trx.description;
        let finalCategoryName = trx.category;
        
        // --- התיקון הקריטי כאן ---
        // בודקים האם הקטגוריה שהגיעה מהקובץ היא "קטגוריה אמיתית" ולא סתם "כללי"
        const genericNames = ['כללי', 'שונות', '', 'null', 'undefined'];
        let categoryIsGeneric = genericNames.includes(finalCategoryName);
        
        // אם הקטגוריה לא גנרית (כלומר היא "עיצוב הבית" או "מזון"), אז מצאנו קטגוריה!
        let categoryFound = !categoryIsGeneric; 

        // שלב 1: מיפוי ידני (גובר על הכל - אם המשתמש קבע אחרת בעבר)
        const mapping = merchantMapCache.get(trx.rawDescription);
        if (mapping) {
            finalDescription = mapping.newName;
            if (mapping.category) {
                finalCategoryName = mapping.category.name;
                categoryFound = true;
            }
        }

        // שלב 2: חוקים אוטומטיים (רק אם לא מצאנו קטגוריה טובה עדיין)
        if (!categoryFound) {
            for (const rule of categoryRules) {
                if (finalDescription.toLowerCase().includes(rule.keyword.toLowerCase())) {
                    if (rule.category) {
                        finalCategoryName = rule.category.name;
                        categoryFound = true;
                        break;
                    }
                }
            }
        }

        // שלב 3: רק אם בסוף באמת אין קטגוריה (לא מהקובץ, לא ממיפוי ולא מחוקים) - תוסיף למיפוי
        if (!categoryFound) {
            merchantsThatNeedMapping.add(trx.rawDescription);
        }

        return { ...trx, description: finalDescription, category: finalCategoryName };
    });

    return { transactions, unseenMerchants: Array.from(merchantsThatNeedMapping) };
}