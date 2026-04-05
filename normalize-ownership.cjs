const { MongoClient } = require('mongodb');

// Using your hardcoded cluster connection
const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function normalizeOwnership() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Cluster');
    const db = client.db(dbName);

    // 1. Get all users
    const users = await db.collection('users').find({}).toArray();
    console.log(`👥 Found ${users.length} users to process.`);

    let totalUpdated = 0;

    for (const user of users) {
      const userIdStr = user._id.toString();
      
      // 2. Find any product belonging to this user and force it to the new standard
      const result = await db.collection('products').updateMany(
        { 
          $or: [
            { ownerUsername: user.username },
            { creatorId: userIdStr },
            { userId: userIdStr },
            { creatorId: user._id }, // Catch ObjectIds
            { userId: user._id }     // Catch ObjectIds
          ]
        },
        {
          $set: {
            userId: userIdStr,
            creatorId: userIdStr
          },
          $unset: {
            ownerUsername: "" // Permanently remove legacy field
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`Migrated ${result.modifiedCount} products for ${user.username}`);
        totalUpdated += result.modifiedCount;
      }
    }

    console.log('🎉 Ownership Normalization Complete!');
    console.log(`✅ Total products standardized: ${totalUpdated}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

normalizeOwnership();