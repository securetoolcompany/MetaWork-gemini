require('dotenv').config({ path: '.env.local' });
const { connectToDatabase } = require('./lib/mongodb');
const { ObjectId } = require('mongodb'); // ADD THIS

async function repair() {
  try {
    const { db } = await connectToDatabase();
    
    console.log("Repairing variant IDs for product 6a55369d3d641ca31d1d5696...");
    
    // FIX: Search by _id using ObjectId
    const product = await db.collection('products').findOne({ _id: new ObjectId("6a55369d3d641ca31d1d5696") });
    
    if (product && product.variants) {
      const repairedVariants = product.variants.map((v, index) => ({
        ...v,
        id: (!v.id || v.id === "undefined") 
            ? `var_${v.size || 'size'}_${v.color || 'default'}_${index}` 
            : v.id
      }));
      
      await db.collection('products').updateOne(
        { _id: new ObjectId("6a55369d3d641ca31d1d5696") },
        { $set: { variants: repairedVariants } }
      );
      console.log("✅ Repair complete.");
    } else {
      console.log("❌ Product not found or no variants found.");
    }
  } catch (e) {
    console.error("❌ Repair failed:", e);
  } finally {
    process.exit();
  }
}
repair();