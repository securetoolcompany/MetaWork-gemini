require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = 'metawork_db';

async function migratePaths() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log("🚀 Starting DB Migration: metawork -> MetaWork\n");

    const collections = ['products', 'ip_assets', 'users'];
    let totalUpdated = 0;

    for (const colName of collections) {
      console.log(`Checking collection: ${colName}...`);
      const collection = db.collection(colName);

      // Find documents where any field contains the lowercase 'metawork/'
      // We use a regex to find them efficiently
      const cursor = collection.find({
        $or: [
          { mainImage: { $regex: /metawork\//i } },
          { imageUrl: { $regex: /metawork\//i } },
          { image: { $regex: /metawork\//i } },
          { avatar: { $regex: /metawork\//i } },
          { banner: { $regex: /metawork\//i } },
          { "aisleSettings.logo": { $regex: /metawork\//i } },
          { "aisleSettings.heroImage": { $regex: /metawork\//i } },
          { "aisleSettings.aisleSections.items.imageUrl": { $regex: /metawork\//i } }
        ]
      });

      const docs = await cursor.toArray();
      console.log(`Found ${docs.length} documents needing updates in ${colName}.`);

      for (const doc of docs) {
        // Convert the whole document to a string, replace, and parse back
        // This is a "brute force" way to catch nested items in aisleSections
        let docString = JSON.stringify(doc);
        
        // Only replace if it's part of a Cloudinary-style path to avoid 
        // accidentally changing emails or usernames
        const updatedString = docString.replace(/\/metawork\//g, '/MetaWork/');

        if (docString !== updatedString) {
          const updatedDoc = JSON.parse(updatedString);
          delete updatedDoc._id; // Don't try to overwrite the immutable ID

          await collection.replaceOne({ _id: doc._id }, updatedDoc);
          totalUpdated++;
        }
      }
    }

    console.log(`\n✅ Migration Complete! Updated ${totalUpdated} total records.`);
  } catch (error) {
    console.error("❌ Migration Failed:", error);
  } finally {
    await client.close();
  }
}

migratePaths();