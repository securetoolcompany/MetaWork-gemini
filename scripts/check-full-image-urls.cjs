const path = require('path');
const dns = require('dns');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient, ObjectId } = require('mongodb');

// Force DNS (Atlas SRV compatibility)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function checkImageUrls() {
  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI not found');
    return;
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('metawork_db');
  
 const productId = process.argv[2];

const product = await db.collection('products').findOne({
  _id: new ObjectId(productId)
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

  console.log('thumbnailUrl:', product.thumbnailUrl || '(none)');
console.log('imageUrl:', product.imageUrl || '(none)');
console.log('mockupUrl:', product.mockupUrl || '(none)');
console.log('images:', product.images || []);
console.log('mockupImages:', product.mockupImages || []);
console.log('raw product keys:', Object.keys(product));
  
  await client.close();
}

checkImageUrls().catch(console.error);
