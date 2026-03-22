// migrateUsers.cjs
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "metawork_db";

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in .env");
  process.exit(1);
}

async function main() {
  const jsonPath = path.join(__dirname, "metawork_filtered_export.json");
  const raw = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.users)) {
    console.error("No users array found in export JSON.");
    process.exit(1);
  }

  console.log(`Loaded ${data.users.length} legacy users from export.`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("Connected to MongoDB.");

  const db = client.db(DB_NAME);
  const usersCol = db.collection("users");

  // Map legacy WordPress fields to current MetaWork schema
  const legacyUsers = data.users.map((u) => ({
    // Migration tracking
    source: "wp_export",
    legacyUserId: u.id,
    createdByMigrationAt: new Date(),
    
    // Core identity (matching current schema)
    username: u.login,
    name: u.display_name || u.name || u.login,  // ✅ FIXED: displayname → name
    email: u.email,
    
    // Profile fields (empty for legacy, can be filled later)
    bio: "",
    tagline: "",
    location: "",
    website: "",
    avatar: "",
    banner: "",
    contactEmail: u.email,
    phone: "",
    socialLinks: {},
    aisleSettings: {},
    
    // Auth & permissions
    authMethod: "email",
    roles: u.roles || [],
    role: (u.roles || []).includes("creator") ? "creator" : "user",
    membershipTier: "free",
    verified: false,
    
    // Empty structures
    stats: {},
    preferences: {},
    wallets: [],
    
    // Timestamps
    createdAt: u.user_registered ? new Date(u.user_registered) : new Date(),
    updatedAt: new Date(),
  }));

  const bulkOps = legacyUsers.map((userDoc) => ({
    updateOne: {
      filter: { username: userDoc.username },
      update: { $setOnInsert: userDoc },
      upsert: true,
    },
  }));

  console.log(
    `Upserting ${bulkOps.length} users (existing usernames will be preserved).`
  );

  const result = await usersCol.bulkWrite(bulkOps, { ordered: false });

  console.log("Bulk upsert result (users):");
  console.log({
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedCount: Object.keys(result.upsertedIds || {}).length,
  });

  console.log(
    '\nTo remove ALL migrated legacy users later, run:\n' +
      'db.users.deleteMany({ source: "wp_export" })'
  );

  await client.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
