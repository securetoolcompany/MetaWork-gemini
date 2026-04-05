require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function inspectRise() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    // The RISE user ID
    const riseId = "6976ba9474b6ffa77d502a4b";

    // Find the user (checking both String and ObjectId formats just in case)
    const riseUser = await db.collection('users').findOne({
        $or: [
            { _id: riseId },
            { _id: new ObjectId(riseId) },
            { username: "RISE" }
        ]
    });

    if (!riseUser) {
        console.log("❌ Could not find RISE user in the database.");
        return;
    }

    console.log("✅ Found RISE user! Here is exactly what is saved in the database:\n");
    
    // We will print the entire object to see where the URLs are hiding
    console.log(JSON.stringify(riseUser, null, 2));

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

inspectRise();