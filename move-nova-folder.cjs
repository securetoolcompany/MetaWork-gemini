require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function nukeAnaroseBulk() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  // THE REAL ID we just found
  const ALEX_ID = "6976afb5c784b498cbb42afc";

  try {
    await client.connect();
    const db = client.db('metawork_db');

    console.log(`🧨 Commencing purge for User: ${ALEX_ID}`);

    // 1. Delete all products for this user that mention Anarose
    const productResult = await db.collection('products').deleteMany({
      userId: ALEX_ID,
      name: { $regex: /Anarose/i }
    });
    console.log(`✅ Deleted ${productResult.deletedCount} products from the dashboard.`);

    // 2. Delete the 255 IP Assets
    // We check both userId and ownerId fields to be thorough
    const assetResult = await db.collection('ip_assets').deleteMany({
      $or: [
        { userId: ALEX_ID },
        { ownerId: ALEX_ID }
      ]
    });
    console.log(`✅ Deleted ${assetResult.deletedCount} IP assets.`);

    console.log("\n🧹 Anarose stuff is officially gone.");

  } catch (error) {
    console.error("❌ Purge failed:", error.message);
  } finally {
    await client.close();
  }
}

nukeAnaroseBulk();