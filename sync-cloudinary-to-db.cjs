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

async function syncCloudinaryToDB() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(dbName);

    // 1. Fetch all users to build a mapping dictionary
    const users = await db.collection('users').find({}).toArray();
    const userMap = {};
    
    users.forEach(u => {
      if (u.username) userMap[u.username.toLowerCase()] = u._id.toString();
      userMap[u._id.toString()] = u._id.toString(); // Map ID to ID just in case
    });

    // 2. Handle the "RISE" / Hex String Anomaly
    const weirdHex = "6976ba9474b6ffa77d502a4b";
    let riseUser = users.find(u => u.username === 'RISE' || u.username === weirdHex || u._id.toString() === weirdHex);
    
    if (riseUser) {
        if (riseUser.username !== 'RISE') {
            await db.collection('users').updateOne({ _id: riseUser._id }, { $set: { username: 'RISE' } });
        }
        userMap[weirdHex] = riseUser._id.toString();
        userMap['rise'] = riseUser._id.toString();
    }

    // 3. Ask Cloudinary for EVERYTHING inside the "metawork/products/" base folder
    console.log('\n📡 Scanning Cloudinary for ALL misplaced mockups...');
    let resources = [];
    let nextCursor = null;

    do {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'metawork/products/', // ✅ FIXED: Added 'metawork/' to the root prefix
            max_results: 500,
            next_cursor: nextCursor
        });
        resources = resources.concat(result.resources);
        nextCursor = result.next_cursor;
    } while (nextCursor);

    console.log(`📦 Found ${resources.length} stray files in Cloudinary.`);

    let successCount = 0;
    let failCount = 0;

    // 4. Process and Move Each File
    for (const file of resources) {
        const oldPublicId = file.public_id; // e.g. "metawork/products/scott/mockups/654584/mockup_0"
        const parts = oldPublicId.split('/');

        // ✅ FIXED: Shifted array indexes to account for 'metawork' at parts[0]
        // parts[0] = 'metawork'
        // parts[1] = 'products'
        // parts[2] = '[user]'
        // parts[3] = 'mockups'
        // parts[4] = '[productId]'
        // parts[5+] = '[fileName]'
        if (parts.length < 6 || parts[0] !== 'metawork' || parts[1] !== 'products' || parts[3] !== 'mockups') {
            continue; 
        }

        const folderUsername = parts[2];
        const productId = parts[4];
        let fileName = parts.slice(5).join('-'); 

        fileName = fileName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

        let trueUserId = userMap[folderUsername.toLowerCase()];
        
        if (!trueUserId) {
            console.log(`⚠️ Skipping ${oldPublicId} - User '${folderUsername}' not found in DB.`);
            failCount++;
            continue;
        }

        const newPublicId = `MetaWork/users/${trueUserId}/products/mockups/${productId}/${fileName}`;

        console.log(`\n🔄 Processing: ${fileName}`);
        console.log(`   From: ${oldPublicId}`);
        console.log(`   To:   ${newPublicId}`);

        if (oldPublicId === newPublicId) continue;

        try {
            const moveResult = await cloudinary.uploader.rename(oldPublicId, newPublicId, {
                overwrite: true
            });

            const productFilter = { $or: [{ id: productId }] };
            try { productFilter.$or.push({ _id: new ObjectId(productId) }); } catch(e){}
            productFilter.$or.push({ _id: productId }); 

            const dbResult = await db.collection('products').updateOne(
                productFilter,
                { 
                    $set: { 
                        mockupUrl: moveResult.secure_url,
                        updatedAt: new Date()
                    } 
                }
            );

            if (dbResult.matchedCount > 0) {
                console.log(`   ✅ Success! Moved & DB Updated.`);
                successCount++;
            } else {
                console.log(`   ⚠️ Moved, but Product ID '${productId}' wasn't found in DB to link it.`);
                failCount++;
            }

        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
            failCount++;
        }
    }

    console.log('\n🎉 Absolute Sync Complete!');
    console.log(`✅ Successfully moved and linked: ${successCount}`);
    console.log(`❌ Failed or Skipped: ${failCount}`);

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

syncCloudinaryToDB();