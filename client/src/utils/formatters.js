/**
 * Shared formatting utilities for the Fina application.
 * Import from this file instead of re-defining in each component.
 */

/**
 * Format a number as Israeli New Shekel currency.
 * @param {number} value
 * @param {number} [maximumFractionDigits=0]
 */
export const formatCurrency = (value, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value || 0);

/**
 * Format a number as USD.
 * @param {number} value
 */
export const formatUSD = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

/**
 * Format a percentage with one decimal.
 * @param {number} value
 */
export const formatPercent = (value) =>
  `${(value || 0).toFixed(1)}%`;

/**
 * Format a date in Hebrew short format (dd/MM/yyyy).
 * @param {string|Date} date
 */
export const formatDate = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
};

/**
 * Format a date as relative label (e.g. "לפני 3 ימים").
 * Falls back to formatDate for older dates.
 * @param {string|Date} date
 */
export const formatRelativeDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return formatDate(date);
};
