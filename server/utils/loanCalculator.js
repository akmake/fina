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

  for (let i = 1; i <= termInMonths; i++) {
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    const primeRate = getRateForDate(paymentDate, rateHistory);
    const annualRate = primeRate + interestMargin;
    const monthlyInterestRate = annualRate / 100 / 12;

    const interestPayment = remainingBalance * monthlyInterestRate;
    let principalPayment, totalPayment;
    
    if (repaymentType === 'שפיצר') {
      // בשפיצר צריך לחשב את ההחזר החודשי מחדש בכל פעם שהריבית משתנה, או בכל חודש
      // החישוב מתבסס על היתרה הנוכחית, הריבית הנוכחית, ומספר התשלומים שנותרו
      const remainingTerm = termInMonths - i + 1;
      const monthlyPayment = remainingBalance * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, remainingTerm)) / (Math.pow(1 + monthlyInterestRate, remainingTerm) - 1);
      totalPayment = monthlyPayment;
      principalPayment = monthlyPayment - interestPayment;
    } else { // קרן שווה
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