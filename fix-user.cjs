require('dotenv').config();
const { MongoClient } = require("mongodb");

console.log("🚀 Script started...");

async function fix() {
  // Use the URI from your .env file, fallback to local if missing
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  console.log(`🔗 Target URI: ${uri.split('@').pop()}`); // Log URI safely (hiding credentials)

  const client = new MongoClient(uri);

  try {
    console.log("🔌 Connecting to database...");
    await client.connect();
    
    // Use the DB name from env or your default
    const dbName = process.env.MONGODB_DB || "metawork_db";
    const db = client.db(dbName);
    console.log(`📂 Database: ${dbName}`);

    const res = await db.collection("users").updateOne(
      { username: "vYzion" },
      { $set: { id: "6976ba9474b6ffa77d502a65" } }
    );

    console.log("✅ Users matched:", res.matchedCount);
    console.log("✅ Users updated:", res.modifiedCount);

    if (res.matchedCount === 0) {
      console.log("⚠️  User 'vYzion' not found. Check your 'users' collection for the correct username.");
    }

  } catch (e) {
    console.error("❌ CRITICAL ERROR:", e.message);
  } finally {
    await client.close();
    console.log("🏁 Script finished.");
    process.exit();
  }
}

fix();