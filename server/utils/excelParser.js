import MerchantMap from '../models/MerchantMap.js';
import CategoryRule from '../models/CategoryRule.js';

function parseDate(dateInput) {
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) return dateInput;
  if (!dateInput) return null;

  const dateStr = String(dateInput).trim();

  // DD.MM.YY or DD.MM.YYYY (ישראכרט format)
  const dotParts = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotParts) {
    const day = parseInt(dotParts[1], 10);
    const month = parseInt(dotParts[2], 10);
    let year = parseInt(dotParts[3], 10);
    if (year < 100) year += 2000;
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(date.getTime())) return date;
    }
  }

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
    // --- התיקון הקריטי כאן: פונקציית עזר חכמה שעוקפת רווחים נסתרים באקסל ---
    const getValue = (keyPhrases) => {
        for (const actualKey of Object.keys(row)) {
            for (const phrase of keyPhrases) {
                if (actualKey.includes(phrase)) {
                    const val = row[actualKey];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        return val;
                    }
                }
            }
        }
        return null;
    };

    const dateVal = getValue(['תאריך עסקה', 'תאריך רכישה', 'תאריך', 'Date', 'date']);
    const date = parseDate(dateVal);
    
    const descriptionVal = getValue(['שם בית העסק', 'שם בית עסק', 'תיאור', 'Description', 'description']);
    
    // סינון שורות "זבל" - אם אין תאריך או תיאור, מתעלמים מהשורה
    if (!date || !descriptionVal) return null;
    
    const description = String(descriptionVal).trim();

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
            return null; // אם אין סכום, מדלגים
        }
    } else if (type === 'isracard') {
        const amountValue = getValue(['סכום חיוב']);
        if (amountValue == null) return null;
        amount = parseFloat(String(amountValue).replace(/,/g, ''));
        if (isNaN(amount)) return null;
        transactionType = amount < 0 ? 'הכנסה' : 'הוצאה';
        amount = Math.abs(amount);
    } else { // 'cal'
        const amountValue = getValue(["סכום בש\"ח", "סכום עסקה", "סכום חיוב"]);
        if (amountValue == null) return null;
        amount = parseFloat(String(amountValue).replace(/,/g, ''));
        if (isNaN(amount)) return null;
        transactionType = amount < 0 ? 'הכנסה' : 'הוצאה';
        amount = Math.abs(amount);
    }

    // קריאת הקטגוריה מהקובץ
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
            } else if (mapping.categoryName) {
                finalCategoryName = mapping.categoryName;
                categoryFound = true;
            }
        }

        // שלב 2: חוקים אוטומטיים (רק אם לא מצאנו קטגוריה טובה עדיין)
        if (!categoryFound) {
            for (const rule of categoryRules) {
                const keyword = rule.searchString || rule.keyword || '';
                if (keyword && finalDescription.toLowerCase().includes(keyword.toLowerCase())) {
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