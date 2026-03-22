require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

async function fetchPrintfulMockups() {
  try {
    const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
    const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID;
    
    if (!PRINTFUL_API_KEY) {
      console.log('❌ PRINTFUL_API_KEY not found in .env.local');
      return;
    }
    
    if (!PRINTFUL_STORE_ID) {
      console.log('❌ PRINTFUL_STORE_ID not found in .env.local');
      console.log('   Add it: PRINTFUL_STORE_ID=your_store_id_here');
      console.log('   Find it at: https://www.printful.com/dashboard/store');
      return;
    }
    
    console.log('🔌 Connecting to MongoDB...');
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('metawork_db');
    console.log('✅ Connected\n');
    
    const product = await db.collection('products').findOne({
      title: "Slim Fit Polo"
    });
    
    console.log('📦 Testing with product:', product.title);
    console.log('🔗 External Product ID:', product.externalProductId);
    console.log('🏪 Store ID:', PRINTFUL_STORE_ID);
    console.log('');
    
    console.log('🌐 Fetching from Printful API...\n');
    
    const response = await fetch(
      `https://api.printful.com/store/products/@${product.externalProductId}`,
      {
        headers: {
          'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
          'X-PF-Store-Id': PRINTFUL_STORE_ID,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    console.log('📡 API Response Status:', response.status);
    
    if (data.code === 200 && data.result?.sync_product) {
      const syncProduct = data.result.sync_product;
      const variants = data.result.sync_variants || [];
      
      console.log('\n✅ SUCCESS! Found Printful Sync Product\n');
      console.log('='.repeat(80));
      console.log('\n📸 AVAILABLE MOCKUP URLS:\n');
      
      if (syncProduct.thumbnail_url) {
        console.log('Product Thumbnail:');
        console.log(`  ${syncProduct.thumbnail_url}\n`);
      }
      
      if (variants.length > 0) {
        console.log('Variant Mockups:');
        variants.slice(0, 3).forEach((variant, i) => {
          console.log(`\n  Variant ${i + 1} (${variant.name}):`);
          if (variant.files?.length > 0) {
            variant.files.forEach(file => {
              if (file.preview_url) {
                console.log(`    ${file.type}: ${file.preview_url}`);
              }
            });
          }
        });
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('\n💡 These are the REAL mockup URLs from Printful!');
      
    } else {
      console.log('\n❌ Could not fetch product');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
    await client.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fetchPrintfulMockups();
