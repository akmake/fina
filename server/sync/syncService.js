import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_TOKEN_FILE = path.join(__dirname, '.resume_token');

const LOCAL_URI  = process.env.MONGO_URI_LOCAL;
const CLOUD_URI  = process.env.MONGO_URI_CLOUD;
const DB_NAME    = process.env.DB_NAME || 'corse';

const RETRY_DELAY_MS = 5000;

function loadResumeToken() {
  try {
    if (fs.existsSync(RESUME_TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(RESUME_TOKEN_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return null;
}

function saveResumeToken(token) {
  try {
    fs.writeFileSync(RESUME_TOKEN_FILE, JSON.stringify(token));
  } catch (e) {
    console.error('[sync] Failed to save resume token:', e.message);
  }
}

async function applyChange(cloudDb, change) {
  const col = cloudDb.collection(change.ns.coll);

  switch (change.operationType) {
    case 'insert':
      await col.replaceOne(
        { _id: change.fullDocument._id },
        change.fullDocument,
        { upsert: true }
      );
      break;

    case 'update':
    case 'replace':
      if (change.fullDocument) {
        await col.replaceOne(
          { _id: change.documentKey._id },
          change.fullDocument,
          { upsert: true }
        );
      } else {
        const { updatedFields = {}, removedFields = [] } = change.updateDescription;
        const updateOp = {};
        if (Object.keys(updatedFields).length) updateOp.$set = updatedFields;
        if (removedFields.length) updateOp.$unset = Object.fromEntries(removedFields.map(f => [f, '']));
        if (Object.keys(updateOp).length) {
          await col.updateOne({ _id: change.documentKey._id }, updateOp, { upsert: true });
        }
      }
      break;

    case 'delete':
      await col.deleteOne({ _id: change.documentKey._id });
      break;

    default:
      break;
  }
}

async function startSync() {
  const localClient = new MongoClient(LOCAL_URI);
  const cloudClient = new MongoClient(CLOUD_URI);

  try {
    await localClient.connect();
    await cloudClient.connect();
    console.log('[sync] Connected to both local and cloud MongoDB');

    const localDb = localClient.db(DB_NAME);
    const cloudDb  = cloudClient.db(DB_NAME);

    const resumeToken = loadResumeToken();
    const watchOptions = {
      fullDocument: 'updateLookup',
      ...(resumeToken ? { resumeAfter: resumeToken } : {}),
    };

    const changeStream = localDb.watch([], watchOptions);

    changeStream.on('change', async (change) => {
      try {
        await applyChange(cloudDb, change);
        saveResumeToken(change._id);
        console.log(`[sync] ${change.operationType} → ${change.ns.coll}`);
      } catch (err) {
        console.error(`[sync] Error applying change to cloud:`, err.message);
      }
    });

    changeStream.on('error', async (err) => {
      console.error('[sync] Change stream error:', err.message);
      await changeStream.close().catch(() => {});
      await localClient.close().catch(() => {});
      await cloudClient.close().catch(() => {});
      console.log(`[sync] Restarting in ${RETRY_DELAY_MS / 1000}s...`);
      setTimeout(startSync, RETRY_DELAY_MS);
    });

    process.on('SIGTERM', async () => {
      console.log('[sync] Shutting down...');
      await changeStream.close();
      await localClient.close();
      await cloudClient.close();
      process.exit(0);
    });

    console.log(`[sync] Watching database "${DB_NAME}" for changes...`);

  } catch (err) {
    console.error('[sync] Startup error:', err.message);
    await localClient.close().catch(() => {});
    await cloudClient.close().catch(() => {});
    console.log(`[sync] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
    setTimeout(startSync, RETRY_DELAY_MS);
  }
}

startSync();
