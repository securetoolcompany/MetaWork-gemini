require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function checkUsers() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    
    const targetEmails = [
      "alphabjjcananea@gmail.com",
      "ekehcherechi3@gmail.com",
      "rise@gmail.com"
    ];

    console.log("🔍 Checking database for User Aisle Data...\n");

    const users = await db.collection('users').find({
      email: { $in: targetEmails }
    }).toArray();

    if (users.length === 0) {
      console.log("❌ None of the target users were found in the database.");
      return;
    }

    users.forEach(u => {
      console.log(`👤 User: ${u.username} (${u.email})`);
      if (u.aisleSettings) {
        console.log(`✅ Aisle Settings Found:`, JSON.stringify(u.aisleSettings, null, 2));
      } else {
        console.log(`⚠️  No 'aisleSettings' field found for this user.`);
      }
      console.log("------------------------------------------\n");
    });

  } finally {
    await client.close();
  }
}

checkUsers();