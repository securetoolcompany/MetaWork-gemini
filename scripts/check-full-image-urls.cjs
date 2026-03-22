require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { MongoClient } = require('mongodb');

async function checkImageUrls() {
  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI not found');
    return;
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('metawork_db');
  
  const product = await db.collection('products').findOne({
    title: "Slim Fit Polo"
  });
  
  if (!product) {
    console.log('❌ Product not found');
    await client.close();
    return;
  }
  
  console.log('\n📸 FULL IMAGE URL ANALYSIS:\n');
  console.log('Product:', product.title);
  console.log('Product ID:', product.id);
  console.log('\n' + '='.repeat(80) + '\n');
  
  if (product.thumbnailUrl) {
    console.log('thumbnailUrl (FULL):');
    console.log(product.thumbnailUrl);
    console.log('');
  }
  
  if (product.mockupImages?.length) {
    console.log('mockupImages:');
    product.mockupImages.forEach((url, i) => {
      console.log(`  [${i}]: ${url}`);
    });
    console.log('');
  }
  
  if (product.imageUrl) {
    console.log('imageUrl:');
    console.log(product.imageUrl);
    console.log('');
  }
  
  await client.close();
}

checkImageUrls().catch(console.error);
