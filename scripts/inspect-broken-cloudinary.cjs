// scripts/inspect-broken-cloudinary.cjs

const path = require('path');
const fs = require('fs');
const dns = require('dns');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function main() {
  const jsonPath = path.join(__dirname, '..', 'broken-cloudinary-products.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const broken = JSON.parse(raw);

  console.log(`Loaded ${broken.length} broken Cloudinary products from JSON\n`);
  console.log('DNS servers set to:', dns.getServers());

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI env var');
    process.exit(1);
  }

  console.log('Using SRV Mongo URI:', uri);

  const client = new MongoClient(uri);
  await client.connect();

  // 🔧 Explicitly set the DB name instead of client.db()
  const dbName = 'metawork_db'; // same DB your app uses
  const db = client.db(dbName);
  const productsColl = db.collection('products');

  const sampleSize = 50;
  const ids = broken.slice(0, sampleSize).map(p => p._id);

  console.log(`Fetching first ${sampleSize} products from MongoDB...\n`);

  const docs = await productsColl
    .find({ _id: { $in: ids.map(id => new ObjectId(id)) } })
    .toArray();

  for (const doc of docs) {
    console.log('='.repeat(80));
    console.log('Product _id:', doc._id.toString());
    console.log('Title:', doc.title);
    console.log('Slug:', doc.slug);
    console.log('Published:', doc.published);
    console.log('Owner:', doc.ownerId || doc.userId);
    console.log('\nImage-related fields:');
    console.log('  images:', doc.images);
    console.log('  mockupImages:', doc.mockupImages);
    console.log('  mockups:', doc.mockups);
    console.log('  thumbnail:', doc.thumbnail);
    console.log('='.repeat(80));
    console.log();
  }

  await client.close();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});