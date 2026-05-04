const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const PACKS = [
  { name: '50 Credits',   credits: 50,   priceUSDC: 0.50,  type: 'one-time', active: true, highlight: false, sortOrder: 1 },
  { name: '120 Credits',  credits: 120,  priceUSDC: 1.00,  type: 'one-time', active: true, highlight: false, sortOrder: 2 },
  { name: '625 Credits',  credits: 625,  priceUSDC: 5.00,  type: 'one-time', active: true, highlight: true,  sortOrder: 3 },
  { name: '1500 Credits', credits: 1500, priceUSDC: 10.00, type: 'one-time', active: true, highlight: false, sortOrder: 4 },
];

async function seed() {
  const client = new MongoClient(process.env.MONGO_URL);
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || 'metawork_db');
    const col = db.collection('creditPacks');

    // Wipe existing packs first
    await col.deleteMany({});
    console.log('🗑  Cleared existing credit packs');

    const now = new Date();
    const docs = PACKS.map((p) => ({ ...p, createdAt: now, updatedAt: now }));
    const result = await col.insertMany(docs);
    console.log(`✅ Inserted ${result.insertedCount} credit packs:`);
    PACKS.forEach((p) => console.log(`   ${p.name} — $${p.priceUSDC.toFixed(2)}${p.highlight ? ' ⭐ highlighted' : ''}`));
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();