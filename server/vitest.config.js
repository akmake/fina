import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      // החבילה האמיתית מושכת את puppeteer ושוברת resolution של yargs תחת Vitest —
      // הבדיקות לא מריצות סריקה אמיתית, לכן stub
      {
        find: /^israeli-bank-scrapers$/,
        replacement: fileURLToPath(new URL('./tests/stubs/israeli-bank-scrapers.js', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // mongod in-memory לכל קובץ — מריצים קבצים בזה אחר זה
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'vitest-access-0123456789abcdef0123456789abcdef',
      JWT_REFRESH_SECRET: 'vitest-refresh-0123456789abcdef0123456789abcdef',
      // 64 hex chars (32 bytes) — bank-credential encryption (utils/crypto.js)
      FINA_ENCRYPTION_KEY: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    },
  },
});
