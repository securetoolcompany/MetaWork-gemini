// scripts/patch-two-broken-products.cjs

const path = require('path');
const dns = require('dns');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Force DNS for Atlas SRV
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI env var');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  const dbName = 'metawork_db'; // adjust if your DB name differs
  const db = client.db(dbName);
  const productsColl = db.collection('products');

  // Two original broken products + their broken URLs
  const targets = [
    {
      _id: '69d96ebbb7f20754f134ae17',
      url: 'https://res.cloudinary.com/dplnacuyy/image/upload/v1769909960/MetaWork/users/6976ba9374b6ffa77d5029fd/products/mockups/664011/mockup_0.jpg',
    },
    {
      _id: '69d96ebbb7f20754f134adba',
      url: 'https://res.cloudinary.com/dplnacuyy/image/upload/v1769909741/MetaWork/users/6976ba9474b6ffa77d502a2c/products/mockups/664177/mockup_0.jpg',
    },
  ];

  let updatedCount = 0;

  for (const { _id, url } of targets) {
    const productId = new ObjectId(_id);

    const result = await productsColl.updateOne(
      { _id: productId, images: url },
      { $pull: { images: url } }
    );

    if (result.modifiedCount > 0) {
      updatedCount++;
      console.log(`✅ Cleared broken image for product ${_id}`);
    } else {
      console.log(
        `ℹ️ No change for product ${_id} (images did not contain the specified URL)`
      );
    }
  }

  console.log(`\nFinished. Products modified: ${updatedCount} / ${targets.length}`);

  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});