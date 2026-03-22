const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URL;

async function fixVisibility() {
  let client;
  
  try {
    console.log('🔧 Fixing product visibility...\n');
    
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('metawork_db');
    
    // Update all products that have showroomListed: true to isPublic: true
    const result = await db.collection('products').updateMany(
      { 
        showroomListed: true,
        status: { $in: ['active', 'live'] }
      },
      { 
        $set: { isPublic: true },
        $unset: { showroomListed: "" }  // Remove the redundant field
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} products`);
    console.log(`   - Set isPublic: true`);
    console.log(`   - Removed showroomListed field\n`);
    
    // Do the same for IP assets
    const ipResult = await db.collection('ip_assets').updateMany(
      { status: { $in: ['unminted', 'active'] } },
      { 
        $set: { isPublic: true }
      }
    );
    
    console.log(`✅ Updated ${ipResult.modifiedCount} IP assets`);
    console.log(`   - Set isPublic: true\n`);
    
    // Show summary
    const totalPublic = await db.collection('products').countDocuments({ isPublic: true });
    const totalPrivate = await db.collection('products').countDocuments({ isPublic: false });
    
    console.log('📊 SUMMARY:');
    console.log(`   Public products: ${totalPublic}`);
    console.log(`   Private products: ${totalPrivate}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

fixVisibility();
