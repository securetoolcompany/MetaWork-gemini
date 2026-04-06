require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = 'metawork_db';

async function inspectAisleLogic() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // We'll look at AlphaBJJ specifically since you verified they have items
    const user = await db.collection('users').findOne({ email: "alphabjjcananea@gmail.com" });

    console.log("🔍 INSPECTING AISLE STORAGE STRUCTURE\n");

    if (!user || !user.aisleSettings) {
      console.log("❌ User or aisleSettings not found.");
      return;
    }

    const sections = user.aisleSettings.aisleSections || [];
    console.log(`User has ${sections.length} sections defined.\n`);

    sections.forEach((section, idx) => {
      console.log(`Section [${idx}]: ${section.title}`);
      console.log(`Item Count: ${section.items?.length || 0}`);
      
      if (section.items && section.items.length > 0) {
        console.log("Sample Item Structure:", JSON.stringify(section.items[0], null, 2));
      }
      console.log("------------------------------------------");
    });

    // Check Featured Item
    console.log("\n⭐ Featured Item Data:");
    console.log(JSON.stringify(user.aisleSettings.featuredItemData, null, 2));

  } finally {
    await client.close();
  }
}

inspectAisleLogic();