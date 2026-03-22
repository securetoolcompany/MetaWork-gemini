require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

async function cleanupAndAssignRemaining() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('metawork_db');
    
    // 1. DELETE all MFG products (blank products)
    console.log('\n🗑️  Deleting MFG blank products...\n');
    
    const mfgResult = await db.collection('products').deleteMany({
      categories: { $regex: /MFG$/i }
    });
    
    console.log(`✅ Deleted ${mfgResult.deletedCount} MFG products`);
    
    // 2. Find AnaRose user
    const anaRoseUser = await db.collection('users').findOne({
      username: { $regex: '^anarose$', $options: 'i' }
    });
    
    if (!anaRoseUser) {
      console.error('❌ Could not find AnaRose user');
      console.log('🔍 Searching for similar usernames...');
      
      const similar = await db.collection('users').find({
        $or: [
          { username: { $regex: 'ana', $options: 'i' } },
          { name: { $regex: 'ana.*rose', $options: 'i' } }
        ]
      }).toArray();
      
      console.log('Found these similar users:');
      similar.forEach(u => {
        console.log(`   - username: "${u.username}", name: "${u.name || 'N/A'}"`);
      });
      
      return;
    }
    
    console.log(`\n✅ Found user: @${anaRoseUser.username}`);
    const anaRoseUserId = anaRoseUser.id || anaRoseUser._id.toString();
    
    // 3. Assign AnaRose products
    console.log('\n🔧 Assigning AnaRose products...\n');
    
    const anaRoseProducts = await db.collection('products').find({
      userId: null,
      $or: [
        { title: { $regex: /anarose/i } },
        { name: { $regex: /anarose/i } },
        { categories: { $regex: /^anarose$/i } }
      ]
    }).toArray();
    
    console.log(`📦 Found ${anaRoseProducts.length} AnaRose products`);
    
    for (const product of anaRoseProducts) {
      await db.collection('products').updateOne(
        { _id: product._id },
        { 
          $set: { 
            userId: anaRoseUserId,
            creatorId: anaRoseUserId
          } 
        }
      );
      console.log(`✅ ${(product.title || product.name).substring(0, 50)} → @${anaRoseUser.username}`);
    }
    
    // 4. Check what's left
    const remaining = await db.collection('products')
      .countDocuments({ userId: null });
    
    console.log(`\n📊 ${remaining} products still without userId`);
    
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

cleanupAndAssignRemaining();
