require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

async function fixSpecialCases() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('metawork_db');
    
    // Find The Bear Club user by email
    const bearClubUser = await db.collection('users').findOne({
      email: 'victor.d.correa@outlook.com'
    });
    
    if (!bearClubUser) {
      console.error('❌ Could not find user with email victor.d.correa@outlook.com');
      return;
    }
    
    console.log(`✅ Found user: @${bearClubUser.username} (${bearClubUser.email})`);
    const bearClubUserId = bearClubUser.id || bearClubUser._id.toString();
    
    // Find RISE user
    const riseUser = await db.collection('users').findOne({
      username: { $regex: '^rise$', $options: 'i' }
    });
    
    if (!riseUser) {
      console.error('❌ Could not find RISE user');
      return;
    }
    
    console.log(`✅ Found user: @${riseUser.username}`);
    const riseUserId = riseUser.id || riseUser._id.toString();
    
    console.log('\n🔧 Fixing special cases...\n');
    
    // 1. Fix products with "The Bear Club" category
    const bearClubProducts = await db.collection('products').find({
      userId: null,
      $or: [
        { categories: 'The Bear Club' },
        { categories: { $regex: /bear.*club/i } }
      ]
    }).toArray();
    
    console.log(`📦 Found ${bearClubProducts.length} products for The Bear Club`);
    
    for (const product of bearClubProducts) {
      await db.collection('products').updateOne(
        { _id: product._id },
        { 
          $set: { 
            userId: bearClubUserId,
            creatorId: bearClubUserId
          } 
        }
      );
      console.log(`✅ ${(product.title || product.name).substring(0, 50)} → @${bearClubUser.username}`);
    }
    
    // 2. Fix products with "Coach Grippado" → assign to RISE
    const grippaudoProducts = await db.collection('products').find({
      userId: null,
      $or: [
        { categories: 'Coach Grippado' },
        { categories: { $regex: /gripp/i } }
      ]
    }).toArray();
    
    console.log(`\n📦 Found ${grippaudoProducts.length} products with Coach Grippado`);
    
    for (const product of grippaudoProducts) {
      await db.collection('products').updateOne(
        { _id: product._id },
        { 
          $set: { 
            userId: riseUserId,
            creatorId: riseUserId
          } 
        }
      );
      console.log(`✅ ${(product.title || product.name).substring(0, 50)} → @${riseUser.username} (Coach Grippado)`);
    }
    
    console.log('\n✨ Special cases fixed!');
    
    // Check remaining unmatched
    const remaining = await db.collection('products')
      .countDocuments({ userId: null });
    
    console.log(`\n📊 ${remaining} products still without userId`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

fixSpecialCases();
