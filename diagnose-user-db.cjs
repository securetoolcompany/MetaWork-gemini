require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function diagnoseUserDb() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        const db = client.db(dbName);

        const users = await db.collection('users').find({}).toArray();
        console.log(`\n👤 ANALYZING ${users.length} USERS IN DB...`);

        let avatarCount = 0;
        let bannerCount = 0;
        const urlPatterns = {};

        users.forEach(user => {
            // Check Avatars
            const avatarUrl = user.profile?.avatarUrl || user.avatarUrl;
            if (avatarUrl) {
                avatarCount++;
                analyzeUrl(avatarUrl, urlPatterns);
            }

            // Check Banners (can be in profile or aisleSettings)
            const bannerUrl = user.profile?.bannerUrl || user.aisleSettings?.coverImage;
            if (bannerUrl) {
                bannerCount++;
                analyzeUrl(bannerUrl, urlPatterns);
            }
        });

        console.log(`   Users with an active Avatar: ${avatarCount}`);
        console.log(`   Users with an active Banner/Cover: ${bannerCount}`);

        console.log('\n   URL Patterns Currently Saved in Database:');
        Object.entries(urlPatterns).sort((a, b) => b[1] - a[1]).forEach(([pattern, count]) => {
            console.log(`   ├─ ${pattern} (${count} assets)`);
        });

        console.log('\n==================================================');
        console.log('✅ User DB Diagnostic Complete.');

    } catch (err) {
        console.error('❌ Script Error:', err);
    } finally {
        await client.close();
    }
}

// Helper to extract the folder structure from the URL
function analyzeUrl(url, patternsObj) {
    if (typeof url === 'string' && url.includes('/upload/')) {
        const parts = url.split('/upload/');
        const path = parts[1].replace(/^v\d+\//, ''); 
        
        const pathSegments = path.split('/');
        let pattern = 'Unknown Pattern';

        // Extract the root/subfolder structure to see where the DB points
        if (pathSegments.length >= 3) {
            pattern = `${pathSegments[0]}/${pathSegments[1]}/[USER_ALIAS]`;
        } else if (pathSegments.length === 2) {
            pattern = `${pathSegments[0]}/[USER_ALIAS]`;
        } else {
            pattern = pathSegments[0];
        }
        
        patternsObj[pattern] = (patternsObj[pattern] || 0) + 1;
    }
}

diagnoseUserDb();