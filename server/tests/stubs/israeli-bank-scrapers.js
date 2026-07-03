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

export function createScraper() {
  throw new Error('createScraper is stubbed in tests');
}
