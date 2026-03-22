require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function findMockups() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    if (!process.env.MONGODB_URI) {
      console.log('❌ MONGODB_URI not found in environment');
      return;
    }
    
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('metawork_db');
    
    console.log('🔍 SEARCHING FOR EXISTING PRINTFUL MOCKUPS\n');
    console.log('='.repeat(80) + '\n');
    
    // Check products collection for Printful-related fields
    const sampleProduct = await db.collection('products').findOne({
      title: "Slim Fit Polo"
    });
    
    if (!sampleProduct) {
      console.log('❌ Product "Slim Fit Polo" not found');
      await client.close();
      return;
    }
    
    console.log('📦 Product Fields Available:');
    console.log(Object.keys(sampleProduct).join(', '));
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Look for fields that might contain Printful mockup URLs
    const fieldsToCheck = [
      'printfulMockupUrl',
      'printfulMockups',
      'printful_mockup_url',
      'mockup_url',
      'sync_product',
      'printfulProduct',
      'externalProductData',
      'printfulData',
      'printfulSyncProduct'
    ];
    
    console.log('🔎 Checking for Printful mockup fields:\n');
    
    let foundAny = false;
    fieldsToCheck.forEach(field => {
      if (sampleProduct[field]) {
        console.log(`✅ FOUND: ${field}`);
        console.log(`   Value:`, JSON.stringify(sampleProduct[field], null, 2));
        console.log('');
        foundAny = true;
      }
    });
    
    if (!foundAny) {
      console.log('❌ None of the expected Printful fields found\n');
    }
    
    // Check if there's a separate printful_products collection
    console.log('📚 Checking for related collections:\n');
    
    const collections = await db.listCollections().toArray();
    const printfulCollections = collections.filter(c => 
      c.name.toLowerCase().includes('printful') ||
      c.name.toLowerCase().includes('sync') ||
      c.name.toLowerCase().includes('mockup')
    );
    
    if (printfulCollections.length > 0) {
      console.log('✅ Found Printful-related collections:');
      printfulCollections.forEach(c => console.log(`   - ${c.name}`));
      console.log('');
      
      // Check first document in each collection
      for (const col of printfulCollections) {
        const sample = await db.collection(col.name).findOne({});
        if (sample) {
          console.log(`\n📄 Sample from ${col.name}:`);
          console.log(JSON.stringify(sample, null, 2));
        }
      }
    } else {
      console.log('❌ No Printful-related collections found\n');
    }
    
    // Check if externalProductId links to Printful
    console.log('🔗 Checking externalProductId:\n');
    console.log(`externalProductId: ${sampleProduct.externalProductId}`);
    
    if (sampleProduct.externalProductId) {
      console.log('\n💡 This might be a Printful Sync Product ID');
      console.log('   Try fetching from Printful API:');
      console.log(`   GET https://api.printful.com/sync/products/${sampleProduct.externalProductId}`);
    }
    
    await client.close();
    console.log('\n✅ Done');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

findMockups();
