require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(); 
    const users = db.collection("users");
    const products = db.collection("products");

    // 1. Target cherechydraws specifically
    const cherechyId = new ObjectId("6976ba9374b6ffa77d502a03");

    // 2. Query all items containing 'surfer' (case-insensitive)
    const surferItems = await products.find({ 
      slug: { $regex: /surfer/i } 
    }).toArray();

    const itemIds = surferItems.map(p => p._id.toString());
    console.log(`Found ${itemIds.length} Surfer products.`);

    if (itemIds.length === 0) {
      console.log("No surfer products found. Check your product names in Atlas!");
      return;
    }

    // 3. Create/Update the Surfer Collection on the user record
    const updateResult = await users.updateOne(
      { _id: cherechyId },
      { 
        $push: { 
          collections: {
            id: "surfer-collection",
            name: "Surfer Collection",
            description: "High-performance gear and assets for surfers.",
            type: "products",
            itemIds: itemIds,
            publishDate: new Date().toISOString()
          }
        }
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log("Success! The 'Surfer Collection' is now live for cherechydraws.");
    } else {
      console.log("Update failed. Make sure the cherechydraws user exists.");
    }

  } catch (error) {
    console.error("Script Error:", error);
  } finally {
    await client.close();
  }
}

run();