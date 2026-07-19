import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const env = { ...process.env };

const findSystemChrome = () => {
  const candidates = process.platform === 'win32'
    ? [
        join(env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        join(env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : [];

  return candidates.find((candidate) => candidate && existsSync(candidate));
};

if (env.RENDER && !env.PUPPETEER_CACHE_DIR) {
  env.PUPPETEER_CACHE_DIR = '/opt/render/project/.cache/puppeteer';
}

if (!env.RENDER && !env.PUPPETEER_FORCE_DOWNLOAD) {
  const systemChrome = findSystemChrome();
  if (systemChrome) {
    console.log(`[installChrome] System Chrome/Edge found, skipping Puppeteer browser download: ${systemChrome}`);
    process.exit(0);
  }
}

// Self-heal: an interrupted `browsers install` leaves the version folder present but
// chrome(.exe) missing. In that state puppeteer's installer REFUSES to re-download
// ("folder exists but executable is missing") AND executablePath() points at a binary
// that isn't there — so every scrape fails with "Browser was not found". Remove any
// incomplete install before (re)installing.
const cacheDir = env.PUPPETEER_CACHE_DIR || join(os.homedir(), '.cache', 'puppeteer');
const chromeDir = join(cacheDir, 'chrome');
try {
  if (existsSync(chromeDir)) {
    for (const entry of readdirSync(chromeDir)) {
      const base = join(chromeDir, entry);
      if (!statSync(base).isDirectory()) continue;
      const hasBinary =
        existsSync(join(base, 'chrome-win64', 'chrome.exe')) ||
        existsSync(join(base, 'chrome-linux64', 'chrome')) ||
        existsSync(join(base, 'chrome-mac-x64', 'Google Chrome for Testing.app')) ||
        existsSync(join(base, 'chrome-mac-arm64', 'Google Chrome for Testing.app'));
      // only touch actual install folders (skip stray .zip files etc.)
      if (entry.includes('-') && !hasBinary) {
        console.log(`[installChrome] removing incomplete Chrome install: ${entry}`);
        rmSync(base, { recursive: true, force: true });
      }
    }
  }
} catch (err) {
  console.warn('[installChrome] cache cleanup skipped:', err.message);
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
