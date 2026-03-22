// Load environment variables from .env file
require('dotenv').config();

const { MongoClient } = require('mongodb');

async function inspectProducts() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    console.log('Connection string:', process.env.MONGO_URL ? 'Found' : 'Missing');
    
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db(process.env.DB_NAME || 'metawork_db');
    
    console.log(`✅ Connected to database: ${db.databaseName}\n`);
    
    // Get sample product
    const product = await db.collection('products').findOne({});
    
    if (!product) {
      console.log('❌ No products found in database');
      await client.close();
      return;
    }
    
    console.log('📦 Sample Product Fields:', Object.keys(product));
    console.log('\n📄 Sample Product (full):', JSON.stringify(product, null, 2));
    
    // Check if userId exists
    const withUserId = await db.collection('products').countDocuments({ userId: { $exists: true } });
    const total = await db.collection('products').countDocuments({});
    console.log(`\n📊 Products with userId field: ${withUserId} / ${total}`);
    
    // Check for alternative user reference fields
    console.log('\n🔎 Checking for user reference fields:');
    const fields = ['userId', 'user_id', 'creatorId', 'creator_id', 'owner', 'ownerId', 'username', 'creatorUsername'];
    for (const field of fields) {
      const count = await db.collection('products').countDocuments({ [field]: { $exists: true } });
      if (count > 0) {
        const sample = await db.collection('products').findOne({ [field]: { $exists: true } });
        console.log(`  ✓ Field "${field}": ${count} products (sample value: ${JSON.stringify(sample[field])})`);
      } else {
        console.log(`  ✗ Field "${field}": 0 products`);
      }
    }
    
    // Check status field values
    console.log('\n📊 Status field values:');
    const statuses = await db.collection('products').distinct('status');
    for (const status of statuses) {
      const count = await db.collection('products').countDocuments({ status });
      console.log(`  - "${status}": ${count} products`);
    }
    
    // Get a sample user to compare
    console.log('\n👤 Sample User for comparison:');
    const user = await db.collection('users').findOne({});
    if (user) {
      console.log(`  Username: ${user.username}`);
      console.log(`  ID field: ${user.id || 'missing'}`);
      console.log(`  _id field: ${user._id}`);
    }
    
    await client.close();
    console.log('\n✅ Inspection complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

inspectProducts();
