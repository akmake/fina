// client/src/lib/loanCalculator.js

/**
 * הוספת חודשים לתאריך ללא דילוג על חודשים קצרים.
 */
function addMonths(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // אם חרגנו מהחודש (למשל 31 לפברואר), נלך אחורה לסוף החודש הקודם
  if (d.getMonth() !== targetMonth % 12 && d.getMonth() !== (targetMonth % 12 + 12) % 12) {
    d.setDate(0); 
  }
  return d;
}

/**
 * מחשב לוח סילוקין להלוואה בשיטת "שפיצר".
 * @returns {Array<object>} מערך אובייקטים המייצג את לוח הסילוקין.
 */
export function calculateSpitzerSchedule({ principal, annualRate, termInMonths, startDate }) {
  const schedule = [];
  let remainingBalance = principal;
  const monthlyInterestRate = annualRate / 100 / 12;

  let monthlyPayment;
  // טיפול במקרה קצה של ריבית 0
  if (monthlyInterestRate === 0) {
      monthlyPayment = principal / termInMonths;
  } else {
      // נוסחת שפיצר לחישוב ההחזר החודשי הקבוע
      monthlyPayment = principal * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termInMonths)) / (Math.pow(1 + monthlyInterestRate, termInMonths) - 1);
  }

  const start = new Date(startDate);

  for (let i = 1; i <= termInMonths; i++) {
    const interestPayment = remainingBalance * monthlyInterestRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingBalance -= principalPayment;

    const paymentDate = addMonths(start, i);

    schedule.push({
      paymentNumber: i,
      date: paymentDate,
      principal: parseFloat(principalPayment.toFixed(2)),
      interest: parseFloat(interestPayment.toFixed(2)),
      totalPayment: parseFloat(monthlyPayment.toFixed(2)),
      remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2)),
    });
  }
  return schedule;
}

/**
 * מחשב לוח סילוקין להלוואה בשיטת "קרן שווה".
 * @returns {Array<object>} מערך אובייקטים המייצג את לוח הסילוקין.
 */
export function calculateKerenShavaSchedule({ principal, annualRate, termInMonths, startDate }) {
  const schedule = [];
  let remainingBalance = principal;
  const monthlyInterestRate = annualRate / 100 / 12;
  const principalPerMonth = principal / termInMonths;
  
  const start = new Date(startDate);

  for (let i = 1; i <= termInMonths; i++) {
    const interestPayment = remainingBalance * monthlyInterestRate;
    const totalPayment = principalPerMonth + interestPayment;
    remainingBalance -= principalPerMonth;

    const paymentDate = addMonths(start, i);

    schedule.push({
      paymentNumber: i,
      date: paymentDate,
      principal: parseFloat(principalPerMonth.toFixed(2)),
      interest: parseFloat(interestPayment.toFixed(2)),
      totalPayment: parseFloat(totalPayment.toFixed(2)),
      remainingBalance: parseFloat(Math.max(0, remainingBalance).toFixed(2)),
    });
  }
  return schedule;
}