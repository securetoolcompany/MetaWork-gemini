require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const PRINTFUL_API_URL = 'https://api.printful.com';
const STORE_ID = '15804358';
const authHeaders = { 
  'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
  'X-PF-Store-Id': STORE_ID 
};

async function surgicalRepair() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('metawork_db');

    // 1. Get ONLY the products that already exist in your DB and need sync data
    const existingProducts = await db.collection('products').find({
      $or: [
        { sync_variant_id: { $exists: false } },
        { "variations.sync_variant_id": { $exists: false } }
      ]
    }).toArray();

    console.log(`${DRY_RUN ? '🔍 [DRY RUN]' : '🚀 [LIVE MODE]'} checking ${existingProducts.length} existing DB products...`);

    // 2. Load Printful Inventory
    let pfInventory = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await axios.get(`${PRINTFUL_API_URL}/sync/products?limit=100&offset=${offset}`, { headers: authHeaders });
      pfInventory = pfInventory.concat(res.data.result);
      if (res.data.result.length < 100) hasMore = false;
      else offset += 100;
    }

    for (const product of existingProducts) {
      // 3. CATEGORY FILTER: Skip if they belong to unwanted categories
      const categories = Array.isArray(product.categories) ? product.categories.join(' ') : '';
      if (categories.includes('MFG') || categories.includes('Bear Club')) {
        console.log(`⏩ Skipping "${product.title || product.name}": Category match (MFG/Bear Club).`);
        continue;
      }

      const name = (product.title || product.name || '').trim();
      const extId = product.legacyMetadata?._smpf_external_product_id;

      // 4. Exact Match Strategy
      const pfMatch = pfInventory.find(p => 
        (extId && p.external_id === extId) || (p.name.trim() === name)
      );

      if (pfMatch) {
        console.log(`🎯 Match: "${pfMatch.name}"`);
        
        await new Promise(r => setTimeout(r, 300)); // Rate limit protection
        const details = await axios.get(`${PRINTFUL_API_URL}/sync/products/${pfMatch.id}`, { headers: authHeaders });
        const pfVariants = details.data.result.sync_variants;

        const updateFields = {
          sync_product_id: pfMatch.id,
          sync_variant_id: pfVariants[0].id,
          updatedAt: new Date()
        };

        // Deep Variation Mapping
        if (Array.isArray(product.variations)) {
          updateFields.variations = product.variations.map(v => {
            const match = pfVariants.find(pv => 
              pv.name.toLowerCase().includes(v.attributes?.pa_size?.toLowerCase() || '') &&
              pv.name.toLowerCase().includes(v.attributes?.pa_color?.toLowerCase() || '')
            );
            return match ? { ...v, sync_variant_id: match.id, printful_variant_id: match.variant_id } : v;
          });
        }

        if (!DRY_RUN) {
          await db.collection('products').updateOne({ _id: product._id }, { $set: updateFields });
          console.log(`   ✅ Synced.`);
        }
      } else {
        console.log(`❌ No Printful match for: "${name}"`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

surgicalRepair();