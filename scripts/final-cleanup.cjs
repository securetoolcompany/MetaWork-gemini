require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

async function finalCleanup() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('metawork_db');
    
    // 1. Delete Academy products
    console.log('\n🗑️  Deleting Academy products...');
    const academyResult = await db.collection('products').deleteMany({
      categories: 'Academy'
    });
    console.log(`✅ Deleted ${academyResult.deletedCount} Academy products`);
    
    // 2. Delete Cash Out products
    console.log('\n🗑️  Deleting Cash Out products...');
    const cashOutResult = await db.collection('products').deleteMany({
      categories: 'Cash Outs'
    });
    console.log(`✅ Deleted ${cashOutResult.deletedCount} Cash Out products`);
    
    // 3. Delete Job Listing Escrow
    console.log('\n🗑️  Deleting Job Listing Escrow...');
    const escrowResult = await db.collection('products').deleteMany({
      $or: [
        { title: { $regex: /job listing escrow/i } },
        { name: { $regex: /job listing escrow/i } }
      ]
    });
    console.log(`✅ Deleted ${escrowResult.deletedCount} Job Listing Escrow products`);
    
    // 4. Delete Embroidered patches (uncategorized)
    console.log('\n🗑️  Deleting Embroidered patches...');
    const patchesResult = await db.collection('products').deleteMany({
      $or: [
        { title: { $regex: /^embroidered patches$/i } },
        { name: { $regex: /^embroidered patches$/i } }
      ]
    });
    console.log(`✅ Deleted ${patchesResult.deletedCount} Embroidered patches`);
    
    // 5. Find AnnaRose user and assign pet leash
    const annaRoseUser = await db.collection('users').findOne({
      email: 'aiyan.smolak@gmail.com'
    });
    
    if (annaRoseUser) {
      const annaRoseUserId = annaRoseUser.id || annaRoseUser._id.toString();
      
      console.log('\n🔧 Assigning pet leash to AnnaRose...');
      const petLeash = await db.collection('products').findOneAndUpdate(
        { title: { $regex: /pet leash.*my little cuddler/i } },
        { 
          $set: { 
            userId: annaRoseUserId,
            creatorId: annaRoseUserId
          } 
        }
      );
      
      if (petLeash) {
        console.log(`✅ Pet leash → @${annaRoseUser.username}`);
      }
    }
    
    // 6. Find kaiguy user and assign TDX shirt
    console.log('\n🔍 Searching for kaiguy user...');
    const kaiguyUser = await db.collection('users').findOne({
      $or: [
        { username: { $regex: 'kaiguy', $options: 'i' } },
        { name: { $regex: 'kaiguy', $options: 'i' } },
        { email: { $regex: 'kaiguy', $options: 'i' } },
        { bio: { $regex: 'kaiguy', $options: 'i' } }
      ]
    });
    
    if (kaiguyUser) {
      const kaiguyUserId = kaiguyUser.id || kaiguyUser._id.toString();
      console.log(`✅ Found user: @${kaiguyUser.username}`);
      
      console.log('\n🔧 Assigning TDX shirt to kaiguy...');
      const tdxShirt = await db.collection('products').findOneAndUpdate(
        { title: { $regex: /^tdx shirt$/i } },
        { 
          $set: { 
            userId: kaiguyUserId,
            creatorId: kaiguyUserId
          } 
        }
      );
      
      if (tdxShirt) {
        console.log(`✅ TDX Shirt → @${kaiguyUser.username}`);
      }
    } else {
      console.log('❌ Could not find kaiguy user');
      console.log('🔍 Searching for similar usernames...');
      
      const similar = await db.collection('users').find({
        $or: [
          { username: { $regex: 'kai', $options: 'i' } },
          { name: { $regex: 'kai', $options: 'i' } }
        ]
      }).limit(5).toArray();
      
      console.log('Found these similar users:');
      similar.forEach(u => {
        console.log(`   - username: "${u.username}", name: "${u.name || 'N/A'}", email: "${u.email}"`);
      });
    }
    
    // Final count
    const remaining = await db.collection('products')
      .countDocuments({ userId: null });
    
    console.log(`\n✨ Cleanup complete!`);
    console.log(`📊 ${remaining} products still without userId`);
    
    if (remaining > 0) {
      console.log('\n🔍 Remaining products:');
      const stillUnmatched = await db.collection('products')
        .find({ userId: null })
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

finalCleanup();
