/**
 * One-off repair of foreign-currency card deals imported before the 2026-10 fix.
 * Dry run by default — prints what would change. Idempotent.
 *
 *   node scripts/repairForeignTransactions.js                    # dry run, last 365 days
 *   node scripts/repairForeignTransactions.js --apply            # write the changes
 *   node scripts/repairForeignTransactions.js --apply --backfill # + next card sync re-reads the period
 *   node scripts/repairForeignTransactions.js --since=2026-01-01
 *
 * What it does: services/foreignRepair.js.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { repairForeignTransactions } from '../services/foreignRepair.js';

dotenv.config();

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const backfill = args.includes('--backfill');
const sinceArg = args.find((a) => a.startsWith('--since='))?.slice('--since='.length);
const since = sinceArg ? new Date(sinceArg) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing — aborting');
    process.exit(1);
  }
  if (isNaN(since.getTime())) {
    console.error(`invalid --since: ${sinceArg}`);
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`[repair-fx] connected — ${apply ? 'APPLY' : 'DRY RUN'} since ${since.toISOString().slice(0, 10)}`);

  const report = await repairForeignTransactions({ since, apply, backfill, log: (l) => console.log(`[repair-fx] ${l}`) });
  console.log('[repair-fx] report:', report);
  if (!apply) console.log('[repair-fx] dry run — nothing was written. Re-run with --apply to save.');

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('[repair-fx] failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
