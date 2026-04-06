// debug-user-relations.cjs
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

// Use your provided connection string
const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function investigate() {
  const client = new MongoClient(uri);
  const targetEmail = "boxingfituniversity@gmail.com";

  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log(`🔍 INVESTIGATING RELATIONS FOR: ${targetEmail}\n`);

    // 1. Fetch the User
    const user = await db.collection('users').findOne({ email: targetEmail });
    if (!user) {
      console.log("❌ ERROR: User not found in 'users' collection.");
      return;
    }

    const userIdStr = user._id.toString();
    const username = user.username;
    console.log(`👤 User Found:`);
    console.log(`   - ID: ${userIdStr}`);
    console.log(`   - Username: ${username}`);
    console.log(`   - Has aisleSettings: ${!!user.aisleSettings}`);
    console.log("------------------------------------------\n");

    // 2. Search for any products that might belong to this user
    console.log(`📦 SEARCHING PRODUCTS...`);
    const possibleProducts = await db.collection('products').find({
      $or: [
        { ownerId: userIdStr },
        { ownerId: user._id }, // Check for actual ObjectId
        { userId: userIdStr },
        { creatorId: userIdStr },
        { owner: username },
        { creator: username },
        { ownerUsername: username }
      ]
    }).toArray();

    if (possibleProducts.length > 0) {
      console.log(`✅ FOUND ${possibleProducts.length} PRODUCTS:`);
      possibleProducts.forEach((p, i) => {
        console.log(`   [${i}] Title: ${p.name || p.title}`);
        console.log(`       - ownerId in DB: ${JSON.stringify(p.ownerId)}`);
        console.log(`       - owner field: ${p.owner}`);
        console.log(`       - userId field: ${p.userId}`);
      });
    } else {
      console.log("❌ NO PRODUCTS matched the ID or Username filters.");
    }
    console.log("------------------------------------------\n");

    // 3. Search for any IP assets
    console.log(`🌌 SEARCHING IP ASSETS...`);
    const possibleIPs = await db.collection('ip_assets').find({
      $or: [
        { ownerId: userIdStr },
        { ownerId: user._id },
        { owner: username }
      ]
    }).toArray();

    if (possibleIPs.length > 0) {
      console.log(`✅ FOUND ${possibleIPs.length} IP ASSETS:`);
      possibleIPs.forEach((ip, i) => {
        console.log(`   [${i}] Title: ${ip.title || ip.name}`);
        console.log(`       - ownerId in DB: ${JSON.stringify(ip.ownerId)}`);
      });
    } else {
      console.log("❌ NO IP ASSETS matched.");
    }

  } finally {
    await client.close();
  }
}

investigate();