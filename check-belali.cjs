require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkBelali() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is missing in .env.local");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
    const db = client.db();

    // 1. Locate the User by Exact Email
    const targetEmail = 'raionen@yahoo.com';
    const targetUser = await db.collection('users').findOne({
      email: { $regex: new RegExp(`^${targetEmail}$`, 'i') }
    });

    if (targetUser) {
      console.log(`\n🎯 FOUND TARGET USER:`);
      console.log(`   Name: ${targetUser.name || 'N/A'}`);
      console.log(`   Username: ${targetUser.username || 'N/A'}`);
      console.log(`   Email: ${targetUser.email}`);
      console.log(`   ID: ${targetUser._id}`);
    } else {
      console.log(`\n❌ TARGET USER with email '${targetEmail}' NOT FOUND.`);
    }

    // 2. Find Products with "Belali"
    const products = await db.collection('products').find({
      $or: [
        { title: /Belali/i },
        { name: /Belali/i }
      ]
    }).toArray();

    console.log(`\n📦 FOUND ${products.length} 'BELALI' PRODUCTS:`);

    products.forEach((p, i) => {
      console.log(`\n[${i + 1}] Product: ${p.title || p.name}`);
      console.log(`    Product ID: ${p._id}`);
      console.log(`    Current Owner ID: ${p.ownerId || p.userId || 'Undefined'}`);
      console.log(`    Current Owner Name: ${p.ownerUsername || p.owner || 'Undefined'}`);
      
      const img = p.mockupUrl || p.imageUrl || p.mainImage || p.images?.[0] || 'No Image Data';
      console.log(`    Image URL: ${img}`);

      // Check alignment
      if (targetUser) {
        const isOwnerIdMatch = (p.ownerId?.toString() === targetUser._id.toString()) || (p.userId?.toString() === targetUser._id.toString());
        if (isOwnerIdMatch) {
          console.log(`    Status: ✅ ASSIGNED CORRECTLY`);
        } else {
          console.log(`    Status: ❌ MISMATCH (Needs Reassignment)`);
        }
      }
    });

  } catch (error) {
    console.error("\n❌ Script Error:", error);
  } finally {
    await client.close();
    console.log("\nDone.");
  }
}

checkBelali();