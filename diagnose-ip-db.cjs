require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

// The specific aliases we found in the Cloudinary IP folder
const ipAliases = [
    "cherechydraws", "gladys-n", "imo-jumbo-art", "lambert-dipamo-lamdee-1", 
    "lexxi-moncada", "n0va4hub", "nova-1", "quinn-williams-1", "the-bear-club", "unassigned"
];

async function diagnoseIpDb() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        const db = client.db(dbName);

        // ==========================================
        // 1. ANALYZE USERS FOR IP ALIASES
        // ==========================================
        console.log('\n👤 ANALYZING USERS FOR IP ALIASES...');
        const users = await db.collection('users').find({}).toArray();
        
        for (const alias of ipAliases) {
            const match = users.find(u => 
                (u.username && u.username.toLowerCase() === alias.toLowerCase()) ||
                (u.profile?.displayName && u.profile.displayName.toLowerCase() === alias.toLowerCase()) ||
                (alias === 'unassigned' && u.username === 'scott_admin') // Check if you mapped unassigned to admin
            );

            if (match) {
                console.log(`   ✅ Found [${alias}] -> Maps to True ID: ${match._id.toString()}`);
            } else {
                console.log(`   ❌ MISSING USER: Could not find any user matching [${alias}]`);
            }
        }

        // ==========================================
        // 2. FIND THE CORRECT DB COLLECTION
        // ==========================================
        console.log('\n🗂️  FINDING IP COLLECTION...');
        const collections = await db.listCollections().toArray();
        const colNames = collections.map(c => c.name);
        
        const possibleIpCollections = ['ip', 'ips', 'ip_assets', 'ipAssets', 'assets', 'intellectual_property'];
        let targetCollection = null;

        for (const name of possibleIpCollections) {
            if (colNames.includes(name)) {
                targetCollection = name;
                console.log(`   ✅ Found probable IP collection: '${name}'`);
                break; // Stop at the first match
            }
        }

        if (!targetCollection) {
            console.log('   ❌ Could not automatically identify the IP collection in the DB.');
            console.log('   Please let me know what collection name you use for IPs!');
            return; 
        }

        // ==========================================
        // 3. ANALYZE IP ASSET URLS
        // ==========================================
        console.log(`\n📦 ANALYZING IP ASSET URLS IN '${targetCollection}'...`);
        const ipDocs = await db.collection(targetCollection).find({}).toArray();
        console.log(`   Total IP Assets in DB: ${ipDocs.length}`);

        let missingImagesCount = 0;
        const urlPatterns = {};

        ipDocs.forEach(doc => {
            // Check all the common field names used for IP imagery
            let imageUrl = doc.imageUrl || doc.image || doc.fileUrl || doc.assetUrl || doc.url || doc.mockupUrl || null;

            if (!imageUrl) {
                missingImagesCount++;
                return;
            }

            if (typeof imageUrl === 'string' && imageUrl.includes('/upload/')) {
                const parts = imageUrl.split('/upload/');
                const path = parts[1].replace(/^v\d+\//, ''); 
                
                const pathSegments = path.split('/');
                let pattern = 'Unknown Pattern';

                if (pathSegments.length >= 3) {
                    pattern = `${pathSegments[0]}/${pathSegments[1]}/[USER_ALIAS]`;
                }
                
                urlPatterns[pattern] = (urlPatterns[pattern] || 0) + 1;
            }
        });

        console.log(`   IP Assets with NO images saved: ${missingImagesCount}`);
        console.log('\n   URL Patterns Currently Saved in Database:');
        
        Object.entries(urlPatterns).sort((a, b) => b[1] - a[1]).forEach(([pattern, count]) => {
            console.log(`   ├─ ${pattern} (${count} assets)`);
        });

        console.log('\n==================================================');
        console.log('✅ IP DB Diagnostic Complete.');

    } catch (err) {
        console.error('❌ Script Error:', err);
    } finally {
        await client.close();
    }
}

diagnoseIpDb();