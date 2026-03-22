require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function checkProduct() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  
  if (!uri) {
    console.error('No MongoDB URI found in .env.local');
    process.exit(1);
  }
  
  const client = await MongoClient.connect(uri);
  const db = client.db('metawork_db');
  
  const product = await db.collection('products').findOne({
    title: { $regex: /Backpack.*vYzion/i }
  });
  
  console.log(JSON.stringify(product, null, 2));
  
  await client.close();
  process.exit(0);
}

checkProduct();
