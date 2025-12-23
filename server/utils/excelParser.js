// server/utils/excelParser.js
import MerchantMap from '../models/MerchantMap.js';
import CategoryRule from '../models/CategoryRule.js';

function parseDate(dateInput) {
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput;
  }
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
    const date = parseDate(row["תאריך עסקה"]);
    if (!date || !row["שם בית העסק"]) return null;

    let amount, transactionType;
    if (type === 'max') {
        const chargeAmount = parseFloat(String(row["סכום חיוב"]).replace(/,/g, ''));
        const creditAmount = parseFloat(String(row["סכום זיכוי"]).replace(/,/g, ''));
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
        const amountValue = row["סכום בש\"ח"] || row["סכום עסקה"] || row["סכום חיוב"];
        if (amountValue == null) return null;
        amount = parseFloat(String(amountValue).replace(/,/g, ''));
        if (isNaN(amount)) return null;
        transactionType = amount < 0 ? 'הכנסה' : 'הוצאה';
        amount = Math.abs(amount);
    }

    return {
        user: userId,
        date,
        description: row["שם בית העסק"],
        rawDescription: row["שם בית העסק"],
        amount,
        type: transactionType,
        account: 'checking',
        category: row['קטגוריה']?.trim() || 'כללי',
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
        const originalDescription = trx.rawDescription;
        let finalDescription = trx.description;
        let finalCategoryName = trx.category;
        let categoryFound = false;

        // שלב 1: בדיקת מיפוי
        const mapping = merchantMapCache.get(originalDescription);
        if (mapping) {
            finalDescription = mapping.newName;
            if (mapping.category) {
                finalCategoryName = mapping.category.name;
                categoryFound = true;
            }
        }

        // שלב 2: אם המיפוי לא קבע קטגוריה, בדוק חוקים
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

        // שלב 3: אם עדיין אין קטגוריה, הוסף לרשימת המיפוי הידני
        if (!categoryFound) {
            merchantsThatNeedMapping.add(originalDescription);
        }

        return { ...trx, description: finalDescription, category: finalCategoryName };
    });

    return { transactions, unseenMerchants: Array.from(merchantsThatNeedMapping) };
}