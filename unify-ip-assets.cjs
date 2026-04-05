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

// 👇 --- CONFIGURATION --- 👇
const FALLBACK_OWNER = "scott_admin"; 
// 👆 --- END CONFIGURATION --- 👆

async function unifyIpAssetsCloudinaryFirst() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        const db = client.db(dbName);

        // 1. Resolve Fallback Admin ID
        let fallbackId = FALLBACK_OWNER;
        if (!ObjectId.isValid(FALLBACK_OWNER)) {
            const admin = await db.collection('users').findOne({ username: FALLBACK_OWNER });
            if (admin) fallbackId = admin._id.toString();
        }

        // 2. Build User Rosetta Stone
        const users = await db.collection('users').find({}).toArray();
        const userMap = {};
        users.forEach(u => {
            if (u.username) userMap[u.username.toLowerCase()] = u._id.toString();
            if (u.profile?.displayName) userMap[u.profile.displayName.toLowerCase()] = u._id.toString();
            // Handle URL slugs specifically since IP aliases use hyphens
            if (u.profile?.displayName) {
                const slug = u.profile.displayName.toLowerCase().replace(/\s+/g, '-');
                userMap[slug] = u._id.toString();
            }
        });

        // 3. Fetch all legacy IP files from Cloudinary
        console.log('\n📡 Fetching all files from Cloudinary ip-assets folders...');
        let allResources = [];
        const prefixes = ['metawork/ip-assets/', 'MetaWork/ip-assets/']; 

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

        console.log(`📦 Found ${allResources.length} legacy IP assets in Cloudinary.`);

        let successCount = 0;
        let orphanCount = 0;
        let failCount = 0;

        // 4. Process and Relocate
        for (const file of allResources) {
            const oldPublicId = file.public_id;
            const parts = oldPublicId.split('/');

            // Format: metawork / ip-assets / [alias] / default / [fileName]
            if (parts.length < 4) continue;

            const alias = parts[2];
            const rawFileName = parts[parts.length - 1]; // e.g. "Jrk83HsTV05C"

            // Resolve true User ID
            const trueUserId = (alias.toLowerCase() === 'unassigned') ? fallbackId : userMap[alias.toLowerCase()];
            
            if (!trueUserId) {
                console.log(`⚠️ Skipping: Cannot resolve owner for alias [${alias}]`);
                continue;
            }

            console.log(`\n🔄 Processing Cloudinary Asset: ${rawFileName}`);
            console.log(`   From: ${oldPublicId}`);

            // 5. Hunt down this file in the Database
            // We use regex because the DB URL might be .png, .jpg, but Cloudinary stripped it
            const safeRegex = new RegExp(rawFileName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
            
            const dbAsset = await db.collection('ip_assets').findOne({
                $or: [
                    { imageUrl: { $regex: safeRegex } },
                    { image: { $regex: safeRegex } },
                    { fileUrl: { $regex: safeRegex } },
                    { assetUrl: { $regex: safeRegex } }
                ]
            });

            const ipId = dbAsset ? dbAsset._id.toString() : 'orphaned';

            // 6. Sanitize filename for Next.js
            const cleanFileName = rawFileName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
            const newPublicId = `MetaWork/users/${trueUserId}/ip-assets/${ipId}/${cleanFileName}`;

            console.log(`   To:   ${newPublicId}`);

            try {
                // A. Move the file
                const moveResult = await cloudinary.uploader.rename(oldPublicId, newPublicId, { overwrite: true });

                // B. Link to DB
                if (dbAsset) {
                    await db.collection('ip_assets').updateOne(
                        { _id: dbAsset._id },
                        { 
                            $set: { 
                                ...(dbAsset.imageUrl && { imageUrl: moveResult.secure_url }),
                                ...(dbAsset.image && { image: moveResult.secure_url }),
                                ...(dbAsset.fileUrl && { fileUrl: moveResult.secure_url }),
                                ...(dbAsset.assetUrl && { assetUrl: moveResult.secure_url }),
                                userId: trueUserId,
                                updatedAt: new Date()
                            } 
                        }
                    );
                    console.log(`   ✅ DB IP Asset Linked!`);
                    successCount++;
                } else {
                    console.log(`   🛟 Moved Orphan safely (No matching IP found in DB)`);
                    orphanCount++;
                }
            } catch (err) {
                console.error(`   ❌ Failed: ${err.message}`);
                failCount++;
            }
        }

        console.log('\n==================================================');
        console.log('🎉 CLOUDINARY-FIRST IP UNIFICATION COMPLETE');
        console.log(`✅ Moved & Linked to DB: ${successCount}`);
        console.log(`🛟 Safely Relocated Orphans: ${orphanCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log('==================================================');

    } catch (err) {
        console.error('❌ Script Error:', err);
    } finally {
        await client.close();
    }
}

unifyIpAssetsCloudinaryFirst();