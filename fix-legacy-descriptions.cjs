require('dotenv').config({ path: '.env.local' });
const { setDefaultResultOrder } = require('dns');
setDefaultResultOrder('ipv4first');
const { MongoClient } = require('mongodb');

const DB_NAME = 'metawork_db';
const NEW_DESCRIPTION = 'Created with love using MetaWork.tools';
const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
const MONGO_URL = 'mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/metawork_db?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin';
const client = await MongoClient.connect(MONGO_URL);  
const db = client.db(DB_NAME);
  const products = db.collection('products');
  try {
    const matches = await products.find({
      description: { $regex: 'Created from Printful template', $options: 'i' }
    }).toArray();

    if (matches.length === 0) { console.log('✅ No legacy descriptions found.'); return; }

    console.log(`\n🔍 Found ${matches.length} product(s):\n`);
    matches.forEach(p => console.log(`  [${p._id}] "${p.title || p.name}"\n  → "${p.description}"\n`));

    if (DRY_RUN) { console.log('⚠️  DRY RUN — no changes written. Remove --dry-run to apply.'); return; }

    const result = await products.updateMany(
      { _id: { $in: matches.map(p => p._id) } },
      { $set: { description: NEW_DESCRIPTION, updatedAt: new Date() } }
    );
    console.log(`✅ Updated ${result.modifiedCount} product(s).`);
  } finally {
    await client.close();
  }
}

run().catch(err => { console.error('❌ Failed:', err.message); process.exit(1); });