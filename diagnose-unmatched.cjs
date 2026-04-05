const { MongoClient } = require('mongodb');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function inspectUnmatched() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);

    // Get the IDs of any ghost user (users without usernames)
    const ghostUsers = await db.collection('users').find({
        $or: [
            { username: null },
            { username: { $exists: false } }
        ]
    }).toArray();

    const ghostIds = ghostUsers.map(u => u._id.toString());

    // Find products still assigned to ghost IDs
    const strandedProducts = await db.collection('products').find({
        userId: { $in: ghostIds }
    }).toArray();

    console.log(`\n📦 Found ${strandedProducts.length} stranded products remaining.`);

    const categoryCounts = {};
    let noCategoriesCount = 0;

    strandedProducts.forEach(p => {
        if (!p.categories || p.categories.length === 0) {
            noCategoriesCount++;
        } else {
            const catStr = p.categories.join(', ');
            categoryCounts[catStr] = (categoryCounts[catStr] || 0) + 1;
        }
    });

    console.log(`\n⚠️ Products with absolutely NO categories: ${noCategoriesCount}`);
    
    if (Object.keys(categoryCounts).length > 0) {
        console.log(`\n🏷️ Unmatched Categories (We need to map these to real users):`);
        Object.entries(categoryCounts).forEach(([cat, count]) => {
            console.log(`   - "${cat}" (${count} products)`);
        });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

inspectUnmatched();