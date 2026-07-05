// Stub לבדיקות — טעינת החבילה האמיתית מושכת את puppeteer וגורמת
// לתקלת resolution של yargs תחת Vitest. הבדיקות לא מריצות סריקה אמיתית.
export const CompanyTypes = {
  hapoalim: 'hapoalim',
  leumi: 'leumi',
  discount: 'discount',
  mercantile: 'mercantile',
  mizrahi: 'mizrahi',
  otsarHahayal: 'otsarHahayal',
  visaCal: 'visaCal',
  max: 'max',
  isracard: 'isracard',
  amex: 'amex',
  union: 'union',
  beinleumi: 'beinleumi',
  massad: 'massad',
  yahav: 'yahav',
  beyahadBishvilha: 'beyahadBishvilha',
  behatsdaa: 'behatsdaa',
  pagi: 'pagi',
  oneZero: 'oneZero',
};

// A configurable fake scrape result so tests can exercise the import job runner
// without launching a real browser. Defaults to one successful expense txn.
const DEFAULT_RESULT = () => ({
  success: true,
  accounts: [
    {
      accountNumber: '12345',
      balance: 5000,
      txns: [
        {
          date: '2026-06-01T00:00:00.000Z',
          processedDate: '2026-06-02T00:00:00.000Z',
          description: 'סופרמרקט הבדיקה',
          chargedAmount: -137.5,
          chargedCurrency: 'ILS',
          originalAmount: -137.5,
          originalCurrency: 'ILS',
          status: 'completed',
          type: 'normal',
          identifier: 'stub-txn-1',
        },
      ],
    },
  ],
  futureDebits: [],
});

let nextResult = DEFAULT_RESULT();

/** Test helper — set the result the next createScraper().scrape() returns. */
export function __setScrapeResult(result) {
  nextResult = result;
}

/** Test helper — restore the default single-transaction success result. */
export function __resetScrapeResult() {
  nextResult = DEFAULT_RESULT();
}

export function createScraper() {
  return {
    otpContext: 'stub-otp-context',
    scrape: async () => nextResult,
    triggerTwoFactorAuth: async () => ({ success: true }),
    getLongTermTwoFactorToken: async () => ({ success: true, longTermTwoFactorAuthToken: 'stub-long-term-token' }),
  };
}
