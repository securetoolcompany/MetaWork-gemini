require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function forceAlignByPath() {
  const MRI_ID = "6976ba9474b6ffa77d502a34";
  const USERNAME = "M.R. Illustration";
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  try {
    console.log("🛠️  Force-aligning assets by Cloudinary path...");

    // Instead of filtering by ID (which is failing), we filter by the 
    // unique M.R. Illustration path we just created in Cloudinary.
    const query = { 
      image: { $regex: `users/${MRI_ID}/ip-assets` } 
    };

    const result = await db.collection('ip_assets').updateMany(
      query,
      { 
        $set: { 
          ownerUsername: USERNAME,
          userId: MRI_ID, // Re-writing it to ensure it's a clean string
          ownerId: MRI_ID,
          status: "active", 
          collection: "all"
        } 
      }
    );

    console.log(`✅ Successfully aligned ${result.modifiedCount} assets.`);

    if (result.modifiedCount === 0) {
      console.log("🔎 Still 0? Checking for ANY assets in the collection...");
      const count = await db.collection('ip_assets').countDocuments();
      console.log(`Total documents in ip_assets: ${count}`);
    }

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.close();
  }
}

forceAlignByPath();