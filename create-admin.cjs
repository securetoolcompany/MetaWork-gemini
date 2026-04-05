require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs'); // ✅ Added for secure password hashing

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function createAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(dbName);

    const adminUsername = "scott_admin";
    const adminEmail = "admin@metawork.com"; 
    const plainTextPassword = "SuperSecretPassword123!"; // 👈 Change this to your desired password

    // 1. Check if the admin already exists
    let adminUser = await db.collection('users').findOne({ username: adminUsername });

    if (adminUser) {
        console.log(`\n⚠️ Admin account '${adminUsername}' already exists!`);
        console.log(`🔑 Your Admin ID is: ${adminUser._id.toString()}`);
    } else {
        console.log(`\n🏗️ Creating new Admin account...`);
        
        // 2. Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainTextPassword, salt);

        // 3. Create the robust Admin profile
        const newAdmin = {
            username: adminUsername,
            email: adminEmail,
            password: hashedPassword, // ✅ Securely hashed password injected here
            role: "admin", 
            profile: {
                displayName: "Scott Holbrook",
                bio: "Platform Administrator",
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            aisleSettings: {
                isPublic: false
            }
        };

        const result = await db.collection('users').insertOne(newAdmin);
        
        console.log(`✅ Admin account created successfully!`);
        console.log(`📧 Login Email: ${adminEmail}`);
        console.log(`🔑 Your Admin ID is: ${result.insertedId.toString()}`);
    }

    console.log('\n📌 COPY THE ID ABOVE AND PASTE IT INTO unify-ip-assets.cjs as the FALLBACK_OWNER');

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

createAdmin();