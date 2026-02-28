export const CREATE_NEW_CATEGORY_VALUE = 'CREATE_NEW';

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
