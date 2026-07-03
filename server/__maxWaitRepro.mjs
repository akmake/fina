import { createRequire } from 'node:module';
import { createScraper, CompanyTypes } from 'israeli-bank-scrapers';
import puppeteer from 'puppeteer';
import { existsSync } from 'node:fs';

// same wrap as scraperController
const require = createRequire(import.meta.url);
const nav = require('israeli-bank-scrapers/lib/helpers/navigation.js');
const orig = nav.waitForRedirect;
nav.waitForRedirect = (p, t = 20000, ...r) => orig(p, Math.max(t, 90000), ...r);
console.log('[repro] waitForRedirect widened to >=90000');

const ep = (()=>{ try { const p=puppeteer.executablePath(); return p && existsSync(p) ? p : undefined; } catch { return undefined; } })();
const start = new Date(); start.setMonth(start.getMonth()-1);
const t0 = Date.now();
const s = createScraper({ companyId: CompanyTypes.max, startDate: start, combineInstallments:false, showBrowser:false, executablePath: ep, defaultTimeout: 90000, navigationRetryCount: 2 });
const res = await s.scrape({ username:'0000000000', password:'wrong-xyz' });
console.log(`[repro] waited ${((Date.now()-t0)/1000).toFixed(0)}s -> success=${res.success} errorType=${res.errorType}`);
process.exit(0);
