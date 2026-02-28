/**
 * פונקציית עזר להוספת חודשים לתאריך בצורה בטוחה.
 * מונעת קפיצת תאריכים (למשל 31 לינואר + חודש -> 28/29 לפברואר ולא מרץ).
 */
function addMonths(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  
  // אם התאריך זלג לחודש הבא (כי אין 31 בחודש היעד), נחזיר אותו לסוף החודש הקודם
  if (d.getMonth() !== targetMonth % 12 && d.getMonth() !== (targetMonth % 12 + 12) % 12) {
    d.setDate(0); 
  }
  return d;
}

/**
 * מחזיר את הריבית שהייתה בתוקף לתאריך מסוים.
 * @param {Date} date - התאריך לבדיקה.
 * @param {Array<object>} rateHistory - מערך ממוין של היסטוריית ריביות.
 * @returns {number} - שיעור הריבית.
 */
function getRateForDate(date, rateHistory) {
  // מוצא את העדכון האחרון שקרה לפני או באותו תאריך תשלום
  const applicableRate = rateHistory
    .filter(r => r.date <= date)
    .pop();
  
  // אם לא נמצא (למשל, הלוואה התחילה לפני שהתחלנו לתעד), השתמש בריבית הראשונה הידועה
  return applicableRate ? applicableRate.rate : (rateHistory[0]?.rate || 0);
}

/**
 * מחשב לוח סילוקין דינמי המבוסס על היסטוריית ריביות משתנה.
 * @returns {Array<object>} מערך אובייקטים המייצג את לוח הסילוקין.
 */
export function calculateDynamicSchedule({ loan, rateHistory }) {
  const { principal, termInMonths, startDate, repaymentType, interestMargin } = loan;
  const schedule = [];
  let remainingBalance = principal;
  const principalPerMonth = repaymentType === 'קרן שווה' ? principal / termInMonths : 0;
  
  const start = new Date(startDate);

  for (let i = 1; i <= termInMonths; i++) {
    // שימוש בפונקציה המתוקנת לחישוב תאריך
    const paymentDate = addMonths(start, i);

    const primeRate = getRateForDate(paymentDate, rateHistory);
    const annualRate = primeRate + interestMargin;
    const monthlyInterestRate = annualRate / 100 / 12;

    const interestPayment = remainingBalance * monthlyInterestRate;
    let principalPayment, totalPayment;
    
    if (repaymentType === 'שפיצר') {
      // בשפיצר צריך לחשב את ההחזר החודשי מחדש בכל פעם שהריבית משתנה
      const remainingTerm = termInMonths - i + 1;
      
      // הגנה מפני חלוקה באפס במקרה של ריבית 0
      if (monthlyInterestRate === 0) {
          totalPayment = remainingBalance / remainingTerm;
      } else {
          totalPayment = remainingBalance * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, remainingTerm)) / (Math.pow(1 + monthlyInterestRate, remainingTerm) - 1);
      }
      principalPayment = totalPayment - interestPayment;
    } 
    // --- תוספת/תיקון: תמיכה בהלוואת בלון בחישוב הדינמי בשרת ---
    else if (repaymentType === 'בלון') {
      principalPayment = (i === termInMonths) ? remainingBalance : 0;
      totalPayment = principalPayment + interestPayment;
    } 
    else { // קרן שווה
      principalPayment = principalPerMonth;
      totalPayment = principalPayment + interestPayment;
    }
    
    remainingBalance -= principalPayment;

    schedule.push({
      paymentNumber: i,
      date: paymentDate,
      principal: parseFloat(principalPayment.toFixed(2)),
      interest: parseFloat(interestPayment.toFixed(2)),
      totalPayment: parseFloat(totalPayment.toFixed(2)),
      remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2)),
      rate: annualRate, // הוספת הריבית שהייתה בתוקף לאותו חודש
    });
  }
  return schedule;
}