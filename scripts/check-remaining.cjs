require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function checkRemainingProducts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('metawork_db');
    
    const unmatched = await db.collection('products')
      .find({ userId: null })
      .limit(50)
      .toArray();
    
    console.log(`📦 ${unmatched.length} remaining unmatched products:\n`);
    
    const categorySet = new Set();
    
    unmatched.forEach(product => {
      const title = (product.title || product.name || 'Untitled').substring(0, 60);
      const cats = product.categories ? product.categories.join(', ') : 'No categories';
      console.log(`- ${title}`);
      console.log(`  Categories: ${cats}\n`);
      
      if (product.categories) {
        product.categories.forEach(cat => categorySet.add(cat));
      }
    });
    
    console.log('\n📊 Unique categories in unmatched products:');
    Array.from(categorySet).sort().forEach(cat => {
      console.log(`   - ${cat}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkRemainingProducts();
