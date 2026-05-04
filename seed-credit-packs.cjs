import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'metawork_db';

if (!uri) { console.error('ERROR: MONGO_URL not set'); process.exit(1); }

// 1 credit = $0.01 | MINT_IP costs 25 credits = $0.25
const DEFAULT_PACKS = [
  { name: 'Starter', credits: 100,  priceUSDC: 1.00,  type: 'one-time', active: true, sortOrder: 1 },
  { name: 'Pro',     credits: 500,  priceUSDC: 4.50,  type: 'one-time', active: true, sortOrder: 2 },
  { name: 'Studio',  credits: 2000, priceUSDC: 15.00, type: 'one-time', active: true, sortOrder: 3 },
];

async function seed() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('creditPacks');

  const existing = await col.countDocuments();
  if (existing > 0) {
    console.log(`Already has ${existing} packs. Drop the collection to re-seed.`);
    await client.close();
    return;
  }

  const now = new Date();
  const docs = DEFAULT_PACKS.map((p) => ({ ...p, createdAt: now, updatedAt: now }));
  const result = await col.insertMany(docs);
  console.log(`✅ Seeded ${result.insertedCount} credit packs`);
  await client.close();
}

seed().catch((err) => { console.error(err); process.exit(1); });