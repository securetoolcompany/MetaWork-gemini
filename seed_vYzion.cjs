require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

// 1. CONFIGURATION
const uri = process.env.MONGO_URI;
const dbName = 'metawork_db'; // Adjust if your DB name is different
const SALT_ROUNDS = 12;

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("📡 Connected directly to MongoDB...");
    const db = client.db(dbName);

    // ---------------------------------------------------------
    // 1. CREATE/UPDATE USER (vYzion)
    // ---------------------------------------------------------
    const hashedPassword = await bcrypt.hash('password123!', SALT_ROUNDS);
    
    // We update if exists, or create if not (upsert)
    const userResult = await db.collection('users').findOneAndUpdate(
      { username: 'vYzion' },
      { 
        $set: {
          email: 'vYzion@metawork.com', 
          password: hashedPassword,
          username: 'vYzion',
          displayName: 'vYzion',
          role: 'creator',
          updatedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    const vYzionId = userResult._id.toString();
    console.log(`✅ User vYzion ready (ID: ${vYzionId})`);

    // ---------------------------------------------------------
    // 2. SEED IP ASSETS (10 items)
    // ---------------------------------------------------------
    await db.collection('ip_assets').deleteMany({ ownerId: vYzionId });
    
    const ipTags = ['Combat Sports', 'Illustration', 'Cyberpunk', 'Tucson Art', 'Abstract'];
    const ipAssets = Array.from({ length: 10 }).map((_, i) => ({
      ownerId: vYzionId,
      title: `vYzion Concept Art #${i + 1}`,
      tags: [ipTags[i % ipTags.length]],
      imageUrl: `https://picsum.photos/seed/ip_art_${i}/800/800`,
      status: 'vaulted',
      createdAt: new Date()
    }));

    await db.collection('ip_assets').insertMany(ipAssets);
    console.log("✅ 10 IP Assets injected.");

    // ---------------------------------------------------------
    // 3. SEED PRODUCTS (20 items)
    // ---------------------------------------------------------
    await db.collection('products').deleteMany({ userId: vYzionId });
    
    const productTypes = [
      { cat: 'Hoodies', title: 'vYzion Stealth Hoodie' },
      { cat: 'Drinkware', title: 'Industrial Tech Mug' },
      { cat: 'Combat Sports', title: 'Alpha BJJ Rash Guard' },
      { cat: 'Home Decor', title: 'Studio Wall Art' }
    ];

    const products = Array.from({ length: 20 }).map((_, i) => {
      const type = productTypes[i % productTypes.length];
      return {
        userId: vYzionId,
        title: `${type.title} Vol. ${i + 1}`,
        price: (Math.random() * 30 + 25).toFixed(2),
        categories: [type.cat],
        imageUrl: `https://picsum.photos/seed/prod_main_${i}/600/600`,
        mockupImages: [
          `https://picsum.photos/seed/m1_${i}/600/600`,
          `https://picsum.photos/seed/m2_${i}/600/600`
        ],
        stockStatus: 'instock',
        source: 'seed_script',
        createdAt: new Date()
      };
    });

    await db.collection('products').insertMany(products);
    console.log("✅ 20 Products injected.");

  } catch (err) {
    console.error("❌ Direct Mongo Seed Failed:", err);
  } finally {
    await client.close();
    console.log("🔌 Connection closed.");
  }
}

seed();