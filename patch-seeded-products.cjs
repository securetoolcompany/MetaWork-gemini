const { MongoClient } = require('mongodb');
const path = require('path');

// 1. Load the env vars from .env.local
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

// 2. Grab the URI
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("ERROR: MONGODB_URI not found in .env.local");
  process.exit(1);
}

const client = new MongoClient(uri);

async function patch() {
  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    
    // Using 'metawork_db' based on your DB_NAME env var
    const db = client.db('metawork_db'); 
    
    console.log("Patching products...");
    const productResult = await db.collection('products').updateMany(
      { isSyncedWithMongo: { $ne: true } },
      { $set: { isSyncedWithMongo: true } }
    );
    console.log(`Updated ${productResult.modifiedCount} products.`);

    console.log("Patching IP assets...");
    const ipResult = await db.collection('ip_assets').updateMany(
      { isSyncedWithMongo: { $ne: true } },
      { $set: { isSyncedWithMongo: true } }
    );
    console.log(`Updated ${ipResult.modifiedCount} IP assets.`);

    console.log("Successfully aligned seeded data with frontend flags.");

  } catch (err) {
    console.error("Patch failed:", err);
  } finally {
    await client.close();
  }
}

patch();