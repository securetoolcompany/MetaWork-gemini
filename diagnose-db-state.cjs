require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

// These are the weird folder names we found in Cloudinary
const cloudinaryAliases = [
    "777jc", "AlphaBJJ", "Ares Arizona BJJ", "Boxing Fit University", 
    "cherechydraws", "Invictus Gym", "jeffykings", "KAPAO", "LegionMMA", 
    "M.R. Illustration", "panacea_point", "RISE", "Taiwo", "Tremblay BJJ MMA", 
    "Und1sputed Arizona", "user_1769104841665_7btkj7", "user_1770136060771_akdfhr",
    "user_1774487724918_z9dt5", "user_1774566516854_9fxi1j", "user_1774807089965_17mpqv",
    "user_1774807223610_fxkfub", "user_1775083052617_94zfmt"
];

async function diagnoseDBState() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(dbName);

    // ==========================================
    // 1. ANALYZE USERS
    // ==========================================
    console.log('\n👤 ANALYZING USERS...');
    const users = await db.collection('users').find({}).toArray();
    console.log(`   Total Users in DB: ${users.length}`);

    console.log('\n   Checking Cloudinary Aliases against DB Users:');
    for (const alias of cloudinaryAliases) {
        // Look for this alias in _id, username, or displayName
        const match = users.find(u => 
            u._id.toString() === alias || 
            (u.username && u.username.toLowerCase() === alias.toLowerCase()) ||
            (u.profile?.displayName && u.profile.displayName.toLowerCase() === alias.toLowerCase())
        );

        if (match) {
            console.log(`   ✅ Found [${alias}] -> Maps to True ID: ${match._id.toString()}`);
        } else {
            console.log(`   ❌ MISSING: Could not find any user matching [${alias}]`);
        }
    }

    // ==========================================
    // 2. ANALYZE PRODUCT URLS
    // ==========================================
    console.log('\n📦 ANALYZING PRODUCT IMAGE URLS...');
    const products = await db.collection('products').find({}).toArray();
    console.log(`   Total Products in DB: ${products.length}`);

    const urlPatterns = {};
    let missingImagesCount = 0;

    products.forEach(p => {
        // Gather all possible images this product might be using
        let allImages = [];
        if (Array.isArray(p.images)) allImages.push(...p.images);
        if (Array.isArray(p.mockupImages)) allImages.push(...p.mockupImages);
        if (Array.isArray(p.mockupUrls)) allImages.push(...p.mockupUrls);
        if (p.mockupUrl) allImages.push(p.mockupUrl);

        if (allImages.length === 0) {
            missingImagesCount++;
            return;
        }

        // Extract the base folder path from the first image to see what the DB expects
        const sampleUrl = allImages[0];
        if (typeof sampleUrl === 'string' && sampleUrl.includes('/upload/')) {
            const parts = sampleUrl.split('/upload/');
            const path = parts[1].replace(/^v\d+\//, ''); // strip versioning
            
            // Extract just the root and user parts to find patterns
            // e.g., metawork/users/Boxing Fit University/... -> metawork/users/[Alias]
            const pathSegments = path.split('/');
            let pattern = 'Unknown Pattern';

            if (pathSegments.length >= 3) {
                pattern = `${pathSegments[0]}/${pathSegments[1]}/[USER_ALIAS]`;
            }
            
            urlPatterns[pattern] = (urlPatterns[pattern] || 0) + 1;
        }
    });

    console.log(`   Products with NO images saved: ${missingImagesCount}`);
    console.log('\n   URL Patterns Currently Saved in Database:');
    
    Object.entries(urlPatterns).sort((a, b) => b[1] - a[1]).forEach(([pattern, count]) => {
        console.log(`   ├─ ${pattern} (${count} products)`);
    });

    console.log('\n==================================================');
    console.log('✅ DB Diagnostic Complete.');

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

diagnoseDBState();