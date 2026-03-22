// clearIPAssets.cjs - Clear ip_assets collection
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  console.log('=== Clearing IP Assets Collection ===\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('metawork');
  const ipAssets = db.collection('ip_assets');

  const count = await ipAssets.countDocuments();
  console.log(`Found ${count} IP assets in database`);

  if (count > 0) {
    const result = await ipAssets.deleteMany({});
    console.log(`✓ Deleted ${result.deletedCount} IP assets\n`);
  } else {
    console.log('Collection is already empty\n');
  }

  console.log('=== Complete ===');
  console.log('Ready for fresh IP upload!');

  await client.close();
}

main().catch(console.error);
