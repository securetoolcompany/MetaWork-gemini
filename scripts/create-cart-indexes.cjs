require('dotenv').config();
const { MongoClient } = require('mongodb');

async function createCartIndexes() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    
    // Try multiple env var names
    const mongoUrl = process.env.MONGO_URL || 
                     process.env.MONGODB_URI || 
                     process.env.MONGO_URI || 
                     process.env.MONGODB_URL;
    
    if (!mongoUrl) {
      throw new Error('No MongoDB connection string found in .env');
    }
    
    console.log('Connection string found:', mongoUrl.substring(0, 30) + '...');
    
    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(process.env.DB_NAME || 'metawork_db');
    
    console.log('✅ Connected to database:', db.databaseName);
    
    // Create indexes on carts collection
    console.log('\n📊 Creating cart indexes...');
    
    await db.collection('carts').createIndex({ userId: 1 });
    console.log('✓ Created index on userId');
    
    await db.collection('carts').createIndex({ sessionId: 1 });
    console.log('✓ Created index on sessionId');
    
    await db.collection('carts').createIndex(
      { expiresAt: 1 }, 
      { expireAfterSeconds: 0 }
    );
    console.log('✓ Created TTL index on expiresAt');
    
    console.log('\n✅ All cart indexes created successfully!');
    
    await client.close();
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    process.exit(1);
  }
}

createCartIndexes();
