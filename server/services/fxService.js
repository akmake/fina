/**
 * fxService — ILS exchange rates for converting foreign-currency card charges.
 *
 * Card companies report a foreign purchase in its original currency and only
 * fill the ILS charge once the deal is billed (pending deals arrive with a 0 /
 * missing ILS amount, some cards bill in USD/EUR). Importers use these rates to
 * store an *estimated* ILS amount (`amountEstimated: true`) until the real
 * charge arrives and replaces it (see transactionPersistence).
 */

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 5000;

// Last-resort rates (ILS per unit) when the rates API is unreachable — keeps a
// foreign deal visible instead of dropping it. Always flagged as estimated.
// Snapshot of ECB rates, 2026-10-23 — refresh if they drift far.
const FALLBACK_RATES = { USD: 3.12, EUR: 3.49, GBP: 4.17, CHF: 3.79, CAD: 2.23, AUD: 2.19, JPY: 0.0199 };

const SYMBOL_TO_CODE = {
  '₪': 'ILS', 'ש"ח': 'ILS', 'ש״ח': 'ILS', 'שח': 'ILS', NIS: 'ILS', 'שקל': 'ILS',
  $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
};

let cache = { rates: null, fetchedAt: 0 };

/** Normalize a scraper currency ('$', 'ש"ח', 'usd') to an ISO code, or null. */
export const normalizeCurrency = (cur) => {
  if (cur == null) return null;
  const s = String(cur).trim();
  if (!s) return null;
  return SYMBOL_TO_CODE[s] || SYMBOL_TO_CODE[s.toUpperCase()] || s.toUpperCase();
};

export const isIls = (cur) => normalizeCurrency(cur) === 'ILS';

const fetchRates = async () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/ILS', { signal: ctrl.signal });
    const data = await res.json();
    const rates = {};
    for (const [code, perIls] of Object.entries(data.rates || {})) {
      if (perIls > 0) rates[code] = 1 / perIls; // ILS per 1 unit
    }
    return rates;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * ILS-per-unit rates for the given currency codes. Never throws: a code with no
 * live rate falls back to FALLBACK_RATES, or is omitted if unknown.
 * @param {string[]} codes
 * @returns {Promise<Record<string, number>>}
 */
export const getIlsRates = async (codes = []) => {
  const wanted = [...new Set(codes.map(normalizeCurrency).filter((c) => c && c !== 'ILS'))];
  if (wanted.length === 0) return {};

  if (!cache.rates || Date.now() - cache.fetchedAt > CACHE_TTL) {
    try {
      cache = { rates: await fetchRates(), fetchedAt: Date.now() };
    } catch (err) {
      console.warn('[fx] rate fetch failed, using fallback rates:', err.message);
    }
  }

  const out = {};
  for (const c of wanted) {
    const rate = cache.rates?.[c] ?? FALLBACK_RATES[c];
    if (rate) out[c] = rate;
  }
  return out;
};

/** Test helper — drop the cached rates. */
export const __resetFxCache = () => { cache = { rates: null, fetchedAt: 0 }; };
