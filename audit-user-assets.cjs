require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

// Use your provided connection string
const uri = process.env.MONGODB_URI || "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function auditAssets() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);

        console.log("🔍 STARTING GLOBAL ASSET CROSS-REFERENCE AUDIT...\n");

        // 1. Fetch all relevant data
        const [users, products, ipAssets] = await Promise.all([
            db.collection('users').find({}).toArray(),
            db.collection('products').find({}).toArray(),
            db.collection('ip_assets').find({}).toArray()
        ]);

        const assetMap = {};

        // 2. Map Users (Avatars and Banners)
        users.forEach(user => {
            const userId = user._id.toString();
            const username = user.username || 'unknown';
            
            if (!assetMap[userId]) assetMap[userId] = { username, email: user.email, profile: [], products: [], ip: [] };

            if (user.avatar) assetMap[userId].profile.push({ type: 'avatar', url: user.avatar });
            if (user.banner) assetMap[userId].profile.push({ type: 'banner', url: user.banner });
            
            // Check Aisle Settings specific images
            if (user.aisleSettings?.logo) assetMap[userId].profile.push({ type: 'aisle_logo', url: user.aisleSettings.logo });
            if (user.aisleSettings?.heroImage) assetMap[userId].profile.push({ type: 'aisle_hero', url: user.aisleSettings.heroImage });
        });

        // 3. Map Products
        products.forEach(p => {
            const ownerId = p.ownerId || p.userId || p.creatorId;
            if (!ownerId) return;

            const ownerIdStr = ownerId.toString();
            if (assetMap[ownerIdStr]) {
                const img = p.mainImage || p.imageUrl || p.mockupUrl || (p.images && p.images[0]);
                if (img) assetMap[ownerIdStr].products.push({ id: p._id.toString(), title: p.name || p.title, url: img });
            }
        });

        // 4. Map IP Assets
        ipAssets.forEach(ip => {
            const ownerId = ip.ownerId || ip.userId;
            if (!ownerId) return;

            const ownerIdStr = ownerId.toString();
            if (assetMap[ownerIdStr]) {
                const img = ip.image || ip.imageUrl || ip.thumbnail;
                if (img) assetMap[ownerIdStr].ip.push({ id: ip._id.toString(), title: ip.title || ip.name, url: img });
            }
        });

        // 5. Output Report
        console.log("==================================================");
        console.log("📂 USER ASSET DISTRIBUTION REPORT");
        console.log("==================================================\n");

        Object.keys(assetMap).forEach(uid => {
            const data = assetMap[uid];
            // Only report on users who actually have images to cross-reference
            if (data.profile.length > 0 || data.products.length > 0 || data.ip.length > 0) {
                console.log(`👤 USER: ${data.username} (${data.email || 'No Email'})`);
                console.log(`   🆔 ID: ${uid}`);
                
                if (data.profile.length > 0) {
                    console.log(`   🖼️  Profile/Aisle Images:`);
                    data.profile.forEach(img => console.log(`      ├─ [${img.type}] ${img.url}`));
                }

                if (data.products.length > 0) {
                    console.log(`   📦 Product Images (${data.products.length}):`);
                    data.products.slice(0, 3).forEach(p => console.log(`      ├─ ${p.url}`));
                    if (data.products.length > 3) console.log(`      └─ (...and ${data.products.length - 3} more)`);
                }

                if (data.ip.length > 0) {
                    console.log(`   🌌 IP Assets (${data.ip.length}):`);
                    data.ip.slice(0, 3).forEach(i => console.log(`      ├─ ${i.url}`));
                    if (data.ip.length > 3) console.log(`      └─ (...and ${data.ip.length - 3} more)`);
                }
                console.log("------------------------------------------\n");
            }
        });

        console.log("✅ Audit Complete.");

    } finally {
        await client.close();
    }
}

auditAssets();