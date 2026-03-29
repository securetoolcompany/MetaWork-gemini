require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId, Double, Int32 } = require('mongodb');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
const CLOUDINARY_BASE = "https://res.cloudinary.com/dplnacuyy/image/upload/v1/metawork";

const MOCK_IMAGE_PATHS = [
  `${CLOUDINARY_BASE}/ip-assets/ip_1.png`,
  `${CLOUDINARY_BASE}/products/Belali/mockups/663334/mockup_0`,
  "https://securemetawork.com/wp-content/uploads/2025/12/clear-case-for-iphone-iphone-7-8-case-on-phone-694222c4e47cd.jpg"
];

const generateUUID = () => crypto.randomUUID();
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedData(db) {
  // Check if collection exists
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log('Available collections:', collectionNames.join(', '));

  if (!collectionNames.includes('users')) {
    console.error('❌ Error: Could not find "users" collection in this database.');
    return;
  }

  console.log('🔍 Fetching existing users...');
  const users = await db.collection('users').find({}).toArray();
  
  if (users.length === 0) {
    console.log('⚠️ No users found in the "users" collection.');
    return;
  }

  console.log(`✅ Found ${users.length} users. Generating 12 products and 12 IPs for each...`);

  const newProducts = [];
  const newIpAssets = [];
  const newCollections = [];
  const allGeneratedProducts = [];

  for (const user of users) {
    // Determine the correct ID field based on your schema
    const userIdStr = user._id.toString();
    const ownerId = user.id || userIdStr; 
    const username = user.username || 'Creator';

    // Generate 12 Products
    for (let i = 1; i <= 12; i++) {
      const realImg = MOCK_IMAGE_PATHS[i % MOCK_IMAGE_PATHS.length];
      const product = {
        _id: new ObjectId(),
        id: `prod_${generateUUID()}`,
        userId: ownerId,
        creatorId: ownerId,
        title: `${username} Series Item ${i}`,
        description: `Test product generated for ${username}.`,
        slug: `test-prod-${generateUUID().split('-')[0]}`,
        price: new Double(randomInt(20, 85) + 0.99),
        regularPrice: new Int32(0),
        categories: ['M.R. Illustration'],
        thumbnailUrl: realImg,
        mockupImages: [realImg, realImg],
        status: 'live',
        isVisible: true,
        isPublic: true,
        stockStatus: 'instock',
        sales: new Int32(randomInt(1, 50)),
        views: new Int32(randomInt(10, 100)),
        createdAt: new Date(),
        isTestSeed: true 
      };
      newProducts.push(product);
      allGeneratedProducts.push(product);
    }

    // Generate 12 IP Assets
    const userIpIds = [];
    for (let i = 1; i <= 12; i++) {
      const realImg = MOCK_IMAGE_PATHS[(i+1) % MOCK_IMAGE_PATHS.length];
      const ipId = `ip_${generateUUID()}`;
      const ipAsset = {
        _id: new ObjectId(),
        id: ipId,
        name: `${username} Original #${i}`,
        description: 'Mock IP Asset.',
        imageUrl: realImg,
        ownerId: ownerId,
        status: 'active',
        licensingTerms: 'commercial',
        isTestSeed: true
      };
      newIpAssets.push(ipAsset);
      userIpIds.push(ipId);
    }

    // Create a Collection
    newCollections.push({
      _id: new ObjectId(),
      id: `col_${generateUUID()}`,
      userId: ownerId,
      name: 'Featured Gear',
      type: 'products',
      itemIds: allGeneratedProducts.slice(-4).map(p => p._id.toString()),
      columns: 4,
      showHeader: true,
      isTestSeed: true
    });
  }

  console.log('💾 Inserting mock data...');
  if (newProducts.length > 0) await db.collection('products').insertMany(newProducts);
  if (newIpAssets.length > 0) await db.collection('ip_assets').insertMany(newIpAssets);
  if (newCollections.length > 0) await db.collection('collections').insertMany(newCollections);

  console.log('🎉 Seeding complete!');
}

async function nukeData(db) {
  console.log('☢️ NUKING TEST DATA...');
  await db.collection('products').deleteMany({ isTestSeed: true });
  await db.collection('ip_assets').deleteMany({ isTestSeed: true });
  await db.collection('collections').deleteMany({ isTestSeed: true });
  console.log('✨ Nuke successful.');
}

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    
    // Explicitly target metawork_db if detected, otherwise fallback to URI default
    const dbName = MONGO_URI.includes('metawork_db') ? 'metawork_db' : (MONGO_URI.split('/').pop().split('?')[0] || 'test');
    console.log(`📡 Connected to Database: ${dbName}`);
    
    const db = client.db(dbName);

    if (process.argv.includes('--nuke')) {
      await nukeData(db);
    } else {
      await seedData(db);
    }
  } catch (error) {
    console.error('Fatal Error:', error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

run();