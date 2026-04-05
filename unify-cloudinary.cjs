require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function unifyCloudinary() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(dbName);

    // ==========================================
    // 1. BUILD THE ROSETTA STONE
    // ==========================================
    const users = await db.collection('users').find({}).toArray();
    const userMap = {};
    
    users.forEach(u => {
        const idStr = u._id.toString();
        userMap[idStr] = idStr; // Map direct IDs (including the user_123 strings)
        if (u.username) userMap[u.username.toLowerCase()] = idStr;
        if (u.profile?.displayName) userMap[u.profile.displayName.toLowerCase()] = idStr;
    });
    
    // Safety Fallbacks for known edge cases
    userMap['m.r. illustration'] = "6976ba9474b6ffa77d502a34";
    userMap['rise'] = "6976ba9474b6ffa77d502a4b";

    // ==========================================
    // 2. FETCH ALL CLOUDINARY FILES
    // ==========================================
    console.log('📡 Fetching all files from Cloudinary...');
    let allResources = [];
    const prefixes = ['metawork/', 'MetaWork/']; // Scan both roots

    for (const prefix of prefixes) {
        let nextCursor = null;
        do {
            const result = await cloudinary.api.resources({
                type: 'upload', prefix: prefix, max_results: 500, next_cursor: nextCursor
            });
            allResources = allResources.concat(result.resources);
            nextCursor = result.next_cursor;
        } while (nextCursor);
    }

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    // ==========================================
    // 3. SMART PATH PARSER & MOVER (UPDATED)
    // ==========================================
    for (const file of allResources) {
        const oldPublicId = file.public_id;
        const parts = oldPublicId.split('/');

        const mockupsIndex = parts.indexOf('mockups');
        if (mockupsIndex === -1) continue; 

        // SMART EXTRACTION:
        let alias = parts[mockupsIndex - 1];
        if (alias === 'users' || alias === 'products') {
            alias = parts[mockupsIndex - 2]; 
        }

        const trueUserId = userMap[alias.toLowerCase()];
        if (!trueUserId) {
            continue; // Skip silently if we don't know the user
        }

        let productId;
        let fileName;

        // 🔥 THE FIX: Check if it's missing the Product ID folder
        if (parts.length === mockupsIndex + 2) {
            // Structure is just .../mockups/[fileName]
            productId = 'orphaned';
            fileName = parts[mockupsIndex + 1];
        } else {
            // Structure is standard .../mockups/[productId]/[fileName]
            productId = parts[mockupsIndex + 1];
            fileName = parts.slice(mockupsIndex + 2).join('-');
        }

        // Sanitize filename
        fileName = fileName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

        const newPublicId = `MetaWork/users/${trueUserId}/products/mockups/${productId}/${fileName}`;

        if (oldPublicId === newPublicId) {
            skipCount++;
            continue;
        }

        console.log(`\n🔄 Moving Mockup:`);
        console.log(`   From: ${oldPublicId}`);
        console.log(`   To:   ${newPublicId}`);

        try {
            const moveResult = await cloudinary.uploader.rename(oldPublicId, newPublicId, { overwrite: true });

            // Only try to link to DB if it's NOT an orphan
            if (productId !== 'orphaned') {
                const productFilter = {
                    $or: [
                        { id: productId },
                        { legacyProductId: productId },
                        { legacyProductId: parseInt(productId, 10) }
                    ]
                };
                try { productFilter.$or.push({ _id: new ObjectId(productId) }); } catch(e){}
                try { productFilter.$or.push({ _id: productId }); } catch(e){}

                const dbUpdate = await db.collection('products').updateOne(
                    productFilter,
                    { 
                        $set: { updatedAt: new Date() },
                        $addToSet: { mockupUrls: moveResult.secure_url }
                    }
                );
                
                if(dbUpdate.matchedCount > 0) {
                    console.log(`   ✅ Linked to Database!`);
                    successCount++;
                } else {
                    console.log(`   ⚠️ Moved successfully, but DB Product '${productId}' not found.`);
                    failCount++; // Count as fail for linking purposes
                }
            } else {
                console.log(`   🛟 Moved Orphan file safely (Not linked to DB).`);
                successCount++; // Count as success since we safely relocated it
            }

        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
            failCount++;
        }
    }

    console.log('\n==================================================');
    console.log('🎉 GRAND UNIFICATION COMPLETE');
    console.log(`✅ Cleaned, Moved & Linked: ${successCount}`);
    console.log(`⏭️ Skipped (Already Perfect): ${skipCount}`);
    console.log(`⚠️ Orphans / Failed: ${failCount}`);
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

unifyCloudinary();