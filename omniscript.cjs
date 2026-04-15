const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function patchAttributes() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('metawork_db');
    const productsCollection = db.collection('products');

    const products = await productsCollection.find({ 
      "variations.name": { $regex: / \/ / } 
    }).toArray();

    console.log(`🛠️ Found ${products.length} products needing attribute patches...`);

    for (const product of products) {
      const updatedVariations = product.variations.map(v => {
        // Splits "AlphaBJJ / XS" -> "XS"
        const cleanSize = v.name.includes(' / ') ? v.name.split(' / ')[1] : v.name;
        
        return {
          ...v,
          name: cleanSize,
          attributes: {
            pa_size: cleanSize.toLowerCase() // Standardizes for your frontend
          }
        };
      });

      await productsCollection.updateOne(
        { _id: product._id },
        { $set: { variations: updatedVariations } }
      );
      console.log(`   ✅ Patched: ${product.name}`);
    }

    console.log('\n✨ Patching complete! Refresh your browser.');
  } finally {
    await client.close();
  }
}

patchAttributes();