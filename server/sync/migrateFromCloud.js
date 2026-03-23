/**
 * One-time migration: copies all data from Atlas (cloud) to local MongoDB.
 * Run once before switching the app to use local MongoDB.
 *
 * Usage: node sync/migrateFromCloud.js
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const LOCAL_URI = process.env.MONGO_URI_LOCAL;
const CLOUD_URI = process.env.MONGO_URI_CLOUD;
const DB_NAME   = process.env.DB_NAME || 'corse';

async function migrate() {
  if (!LOCAL_URI || !CLOUD_URI) {
    console.error('Missing MONGO_URI_LOCAL or MONGO_URI_CLOUD in .env');
    process.exit(1);
  }

  const cloudClient = new MongoClient(CLOUD_URI);
  const localClient = new MongoClient(LOCAL_URI);

  try {
    await cloudClient.connect();
    await localClient.connect();
    console.log('Connected to both databases');

    const cloudDb = cloudClient.db(DB_NAME);
    const localDb = localClient.db(DB_NAME);

    const collections = await cloudDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections to migrate\n`);

    let totalDocs = 0;

    for (const collInfo of collections) {
      const name = collInfo.name;
      const cloudCol = cloudDb.collection(name);
      const localCol = localDb.collection(name);

      const count = await cloudCol.countDocuments();
      if (count === 0) {
        console.log(`  [skip] ${name} — empty`);
        continue;
      }

      console.log(`  [migrating] ${name} — ${count} documents...`);

      const docs = await cloudCol.find({}).toArray();
      await localCol.deleteMany({});
      await localCol.insertMany(docs, { ordered: false });

      const indexes = await cloudCol.indexes();
      for (const idx of indexes) {
        if (idx.name === '_id_') continue;
        try {
          await localCol.createIndex(idx.key, {
            name: idx.name,
            unique: idx.unique,
            sparse: idx.sparse,
            expireAfterSeconds: idx.expireAfterSeconds,
          });
        } catch { /* ignore index errors */ }
      }

      console.log(`  [done]  ${name} — ${count} documents migrated`);
      totalDocs += count;
    }

    console.log(`\nMigration complete: ${totalDocs} total documents copied from cloud to local.`);

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await cloudClient.close();
    await localClient.close();
  }
}

migrate();
