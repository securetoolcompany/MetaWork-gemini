console.log('🚀 Script starting...');
require('dotenv').config();
console.log('✅ Dotenv loaded');
const { MongoClient } = require('mongodb');
console.log('✅ MongoDB imported');

const MONGODB_URI = process.env.MONGODB_URI;
console.log('📝 MongoDB URI:', MONGODB_URI ? 'Found' : 'NOT FOUND');

// ... rest of script


async function assignAnnaRoseProducts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('metawork_db');
    
    // Find AnnaRose user by email
    const annaRoseUser = await db.collection('users').findOne({
      email: 'aiyan.smolak@gmail.com'
    });
    
    if (!annaRoseUser) {
      console.error('❌ Could not find AnnaRose user');
      return;
    }
    
    console.log(`✅ Found user: @${annaRoseUser.username} (${annaRoseUser.name})`);
    const annaRoseUserId = annaRoseUser.id || annaRoseUser._id.toString();
    
    console.log('\n🔧 Assigning AnnaRose/AnaRose products...\n');
    
    // Find all products with AnaRose or AnnaRose in title/name
    const annaRoseProducts = await db.collection('products').find({
      userId: null,
      $or: [
        { title: { $regex: /anarose/i } },
        { name: { $regex: /anarose/i } },
        { title: { $regex: /annarose/i } },
        { name: { $regex: /annarose/i } }
      ]
    }).toArray();
    
    console.log(`📦 Found ${annaRoseProducts.length} AnnaRose products`);
    
    for (const product of annaRoseProducts) {
      await db.collection('products').updateOne(
        { _id: product._id },
        { 
          $set: { 
            userId: annaRoseUserId,
            creatorId: annaRoseUserId
          } 
        }
      );
      console.log(`✅ ${(product.title || product.name).substring(0, 60)} → @${annaRoseUser.username}`);
    }
    
    // Check what's left
    const remaining = await db.collection('products')
      .countDocuments({ userId: null });
    
    console.log(`\n✨ Successfully assigned ${annaRoseProducts.length} products to AnnaRose`);
    console.log(`📊 ${remaining} products still without userId`);
    
    if (remaining > 0) {
      console.log('\n🔍 Remaining unmatched products:');
      const stillUnmatched = await db.collection('products')
        .find({ userId: null })
        .limit(10)
        .toArray();
      
      stillUnmatched.forEach(p => {
        console.log(`   - ${p.title || p.name} (${p.categories ? p.categories.join(', ') : 'No categories'})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

assignAnnaRoseProducts();