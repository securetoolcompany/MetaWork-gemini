require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;

// 1. Configure Cloudinary
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
  console.error("❌ Missing Cloudinary environment variables in .env.local");
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    let cleanUrl = url.startsWith('//') ? `https:${url}` : url;
    const urlObj = new URL(cleanUrl);
    if (!urlObj.hostname.includes('cloudinary.com')) return null;

    const pathParts = urlObj.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) return null;

    let startIndex = uploadIndex + 1;
    if (pathParts[startIndex] && pathParts[startIndex].match(/^v\d+$/)) {
      startIndex++;
    }

    const publicIdWithExt = pathParts.slice(startIndex).join('/');
    return decodeURIComponent(publicIdWithExt.replace(/\.[^/.]+$/, ""));
  } catch (e) {
    return null;
  }
}

async function moveCloudinaryFile(oldUrl, sourceIdStr, targetIdStr) {
  if (!oldUrl || typeof oldUrl !== 'string') return oldUrl;
  
  const oldPublicId = getPublicId(oldUrl);

  if (!oldPublicId || !oldPublicId.includes(sourceIdStr)) return oldUrl; 

  const newPublicId = oldPublicId.replace(sourceIdStr, targetIdStr);

  try {
    console.log(`      ☁️ Moving in Cloudinary:`);
    console.log(`         From: ${oldPublicId}`);
    console.log(`         To:   ${newPublicId}`);
    
    const result = await cloudinary.uploader.rename(oldPublicId, newPublicId, { 
      overwrite: true, 
      invalidate: true 
    });
    
    return result.secure_url;
  } catch (error) {
    console.error(`      ❌ Cloudinary Move Failed for ${oldPublicId}:`, error.message);
    return oldUrl; 
  }
}

async function runFullMigration() {
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

    // ==========================================
    // 1. EXACT PRODUCT LOOKUPS
    // ==========================================
    const sourceProductId = '697e31ecab97f80b2f1405e0'; // Belali
    const targetProductId = '697e31ecab97f80b2f14059e'; // MR Illustration

    const sourceProduct = await db.collection('products').findOne({ _id: new ObjectId(sourceProductId) });
    const targetProduct = await db.collection('products').findOne({ _id: new ObjectId(targetProductId) });

    if (!sourceProduct) throw new Error(`Could not find Source Product ID: ${sourceProductId}`);
    if (!targetProduct) throw new Error(`Could not find Target Product ID: ${targetProductId}`);

    const sourceUserId = sourceProduct.ownerId || sourceProduct.userId;
    const targetUserId = targetProduct.ownerId || targetProduct.userId;

    if (!sourceUserId || !targetUserId) throw new Error("One of the products is missing its owner ID.");

    const sourceIdStr = sourceUserId.toString();
    const targetIdStr = targetUserId.toString();

    if (sourceIdStr === targetIdStr) {
        console.log("⚠️ These products ALREADY belong to the exact same database user ID.");
        process.exit(0);
    }

    // Get the target user document just so we can apply their username to the products
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) });
    const targetUsernameToApply = targetUser?.username || targetUser?.name || 'MR Illustration';

    console.log(`\n🔄 STARTING FULL MIGRATION...`);
    console.log(`   Moving from User ID: ${sourceIdStr}`);
    console.log(`   Moving to User ID: ${targetIdStr} (@${targetUsernameToApply})`);

    // ==========================================
    // 2. MIGRATE PRODUCTS
    // ==========================================
    const products = await db.collection('products').find({
      $or: [
          { ownerId: sourceUserId }, { ownerId: sourceIdStr },
          { userId: sourceUserId }, { userId: sourceIdStr }
      ]
    }).toArray();

    console.log(`\n📦 Found ${products.length} Products to migrate.`);

    for (const p of products) {
      console.log(`\n   Processing Product: ${p.name || p.title}`);
      
      const updates = {
        ownerId: new ObjectId(targetIdStr),
        userId: new ObjectId(targetIdStr),
        owner: targetUsernameToApply,
        ownerUsername: targetUsernameToApply
      };

      if (p.mockupUrl) updates.mockupUrl = await moveCloudinaryFile(p.mockupUrl, sourceIdStr, targetIdStr);
      if (p.mainImage) updates.mainImage = await moveCloudinaryFile(p.mainImage, sourceIdStr, targetIdStr);
      if (p.imageUrl) updates.imageUrl = await moveCloudinaryFile(p.imageUrl, sourceIdStr, targetIdStr);
      if (p.image) updates.image = await moveCloudinaryFile(p.image, sourceIdStr, targetIdStr);
      if (p.thumbnailUrl) updates.thumbnailUrl = await moveCloudinaryFile(p.thumbnailUrl, sourceIdStr, targetIdStr);

      if (p.images && Array.isArray(p.images)) {
        updates.images = await Promise.all(p.images.map(img => moveCloudinaryFile(img, sourceIdStr, targetIdStr)));
      }
      if (p.mockupImages && Array.isArray(p.mockupImages)) {
        updates.mockupImages = await Promise.all(p.mockupImages.map(img => moveCloudinaryFile(img, sourceIdStr, targetIdStr)));
      }

      await db.collection('products').updateOne({ _id: p._id }, { $set: updates });
      console.log(`   ✅ Saved to Database.`);
    }

    // ==========================================
    // 3. MIGRATE IP ASSETS
    // ==========================================
    const ips = await db.collection('ip_assets').find({
      $or: [
          { ownerId: sourceUserId }, { ownerId: sourceIdStr },
          { userId: sourceUserId }, { userId: sourceIdStr }
      ]
    }).toArray();

    console.log(`\n🎨 Found ${ips.length} IP Assets to migrate.`);

    for (const ip of ips) {
      console.log(`\n   Processing IP Asset: ${ip.title || ip.name}`);
      
      const updates = {
        ownerId: new ObjectId(targetIdStr),
        userId: new ObjectId(targetIdStr),
        owner: targetUsernameToApply
      };

      if (ip.image) updates.image = await moveCloudinaryFile(ip.image, sourceIdStr, targetIdStr);
      if (ip.imageUrl) updates.imageUrl = await moveCloudinaryFile(ip.imageUrl, sourceIdStr, targetIdStr);
      if (ip.thumbnail) updates.thumbnail = await moveCloudinaryFile(ip.thumbnail, sourceIdStr, targetIdStr);

      await db.collection('ip_assets').updateOne({ _id: ip._id }, { $set: updates });
      console.log(`   ✅ Saved to Database.`);
    }

    // ==========================================
    // 4. FLAG OLD ACCOUNT
    // ==========================================
    try {
      await db.collection('users').updateOne(
          { _id: new ObjectId(sourceUserId) },
          { $set: { isDuplicate: true, mergedInto: new ObjectId(targetIdStr), mergedDate: new Date() } }
      );
      console.log(`\n✅ MIGRATION COMPLETE! The old account (${sourceIdStr}) has been flagged as a duplicate.`);
    } catch(e) {
      console.log(`\n✅ MIGRATION COMPLETE!`);
    }

  } catch (error) {
    console.error("\n❌ Script Error:", error);
  } finally {
    await client.close();
    console.log("Done.");
  }
}

runFullMigration();