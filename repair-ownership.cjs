const { MongoClient } = require('mongodb');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

function normalizeForMatching(str) {
  return str
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function repairOwnership() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // 1. Get all valid users (ignoring the ghost user)
    const users = await db.collection('users').find({ username: { $exists: true, $ne: null } }).toArray();
    console.log(`📊 Found ${users.length} valid users`);
    
    const userMapExact = new Map();
    const userMapNormalized = new Map();
    
    users.forEach(user => {
      const lower = user.username.toLowerCase();
      const normalized = normalizeForMatching(user.username);
      userMapExact.set(lower, user);
      userMapNormalized.set(normalized, user);
    });

    // 2. Fetch all products to evaluate
    const products = await db.collection('products').find({}).toArray();
    console.log(`📦 Found ${products.length} products to evaluate...`);
    
    let repairedCount = 0;

    // 3. Loop through products and re-link based on category
    for (const product of products) {
      if (!product.categories || product.categories.length === 0) continue;
      
      let matchedUser = null;
      
      for (const category of product.categories) {
        const categoryLower = category.toLowerCase();
        const categoryNormalized = normalizeForMatching(category);
        
        if (userMapExact.has(categoryLower)) {
          matchedUser = userMapExact.get(categoryLower);
          break;
        }
        if (userMapNormalized.has(categoryNormalized)) {
          matchedUser = userMapNormalized.get(categoryNormalized);
          break;
        }
      }
      
      if (matchedUser) {
        const trueUserId = matchedUser._id.toString();
        
        // If the product currently has the WRONG ID (e.g., the undefined user), fix it.
        if (product.userId !== trueUserId || product.creatorId !== trueUserId) {
          await db.collection('products').updateOne(
            { _id: product._id },
            { 
              $set: { 
                userId: trueUserId,
                creatorId: trueUserId 
              } 
            }
          );
          repairedCount++;
        }
      }
    }
    
    console.log(`\n🎉 Successfully repaired ${repairedCount} products back to their true owners!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

repairOwnership();