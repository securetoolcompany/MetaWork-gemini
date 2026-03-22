require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function mapImages() {
  try {
    // Look for the export file in multiple locations
    const possiblePaths = [
      'metawork_complete_export_2026-01-25_21-20-36.json',
      '../metawork_complete_export_2026-01-25_21-20-36.json',
      path.join(__dirname, '..', 'metawork_complete_export_2026-01-25_21-20-36.json')
    ];
    
    let exportFile = null;
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        exportFile = filePath;
        console.log(`✅ Found export file: ${filePath}\n`);
        break;
      }
    }
    
    if (!exportFile) {
      console.log('❌ Migration export file not found!');
      console.log('   Please place metawork_complete_export_2026-01-25_21-20-36.json in:');
      console.log('   - Project root directory');
      console.log('   - OR scripts directory');
      return;
    }
    
    console.log('📂 Loading migration data...');
    const migrationData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    const wooProducts = migrationData.products;
    console.log(`✅ Loaded ${wooProducts.length} WooCommerce products\n`);
    
    console.log('🔌 Connecting to MongoDB...');
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('metawork_db');
    console.log('✅ Connected\n');
    
    const mongoProducts = await db.collection('products').find({}).toArray();
    console.log(`📦 Found ${mongoProducts.length} MongoDB products\n`);
    
    let matched = 0;
    let updated = 0;
    let failed = 0;
    
    console.log('🔄 Matching and updating products...\n');
    
    for (const wooProduct of wooProducts) {
      if (!wooProduct.featured_image_url) continue;
      
      const wooTitle = wooProduct.name;
      const wooId = String(wooProduct.id);
      
      // Try multiple matching strategies
      const mongoProduct = mongoProducts.find(mp => {
        if (mp.title === wooTitle || mp.name === wooTitle) return true;
        if (mp.externalProductId === wooId) return true;
        if (mp.title?.toLowerCase() === wooTitle?.toLowerCase()) return true;
        return false;
      });
      
      if (mongoProduct) {
        matched++;
        
        const galleryUrls = (wooProduct.gallery_images || [])
          .map(img => img.url)
          .filter(url => url && url.startsWith('http'));
        
        const mockupImages = [
          wooProduct.featured_image_url,
          ...galleryUrls
        ].slice(0, 5);
        
        try {
          await db.collection('products').updateOne(
            { _id: mongoProduct._id },
            {
              $set: {
                thumbnailUrl: wooProduct.featured_image_url,
                mockupImages: mockupImages,
                imageUrl: wooProduct.featured_image_url,
                wooCommerceImagesMapped: true,
                imagesMappedAt: new Date()
              }
            }
          );
          
          updated++;
          
          if (updated <= 10) {
            console.log(`✅ ${updated}. ${wooTitle}`);
            console.log(`   ${wooProduct.featured_image_url.substring(0, 70)}...`);
          } else if (updated % 50 === 0) {
            console.log(`✅ Updated ${updated} products...`);
          }
          
        } catch (error) {
          failed++;
          console.log(`❌ Failed: ${wooTitle} - ${error.message}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 FINAL RESULTS:\n');
    console.log(`  ✅ Matched: ${matched} products`);
    console.log(`  ✅ Updated: ${updated} products with real mockups`);
    console.log(`  ❌ Failed: ${failed} products`);
    console.log(`  ⚠️  Unmatched: ${wooProducts.length - matched} WooCommerce products`);
    console.log('\n💡 Refresh showroom at http://localhost:3000/showroom');
    
    await client.close();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

mapImages();
