import { execSync } from 'node:child_process';

const env = { ...process.env };

if (env.RENDER && !env.PUPPETEER_CACHE_DIR) {
  env.PUPPETEER_CACHE_DIR = '/opt/render/project/.cache/puppeteer';
}

console.log('[installChrome] Installing Chrome for Puppeteer...');
if (env.PUPPETEER_CACHE_DIR) {
  console.log(`[installChrome] PUPPETEER_CACHE_DIR=${env.PUPPETEER_CACHE_DIR}`);
}

execSync('npm exec puppeteer browsers install chrome', {
  stdio: 'inherit',
  env,
});

console.log('[installChrome] Chrome installation complete.');
