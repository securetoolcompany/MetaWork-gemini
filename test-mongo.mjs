import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URL;

async function test() {
  console.log('Testing MongoDB connection...');
  console.log('URI starts with:', uri?.substring(0, 20) + '...');
  
  try {
    const client = new MongoClient(uri, { 
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000 
    });
    
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const db = client.db('metawork_db');
    const collections = await db.listCollections().toArray();
    console.log('📦 Collections found:', collections.map(c => c.name).join(', '));
    
    await client.close();
    console.log('Connection closed.');
  } catch (error) {
    console.error('❌ Connection failed:', error.code, error.message);
    if (error.code === 'ECONNRESET') {
      console.log('\n🔍 ECONNRESET means:');
      console.log('   1. Check MongoDB Atlas Network Access (IP whitelist)');
      console.log('   2. Your IP may have changed');
      console.log('   3. Firewall/VPN blocking port 27017');
    }
  }
}

test();
