/**
 * diagnoseIpLinking.cjs
 * 
 * Identifies which products with 2+ usernames should link to IP assets
 * Run with: node diagnoseIpLinking.cjs
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');

const ProductSchema = new mongoose.Schema({}, { strict: false });
const Product = mongoose.model('Product', ProductSchema, 'products');

const IpAssetSchema = new mongoose.Schema({}, { strict: false });
const IpAsset = mongoose.model('IpAsset', IpAssetSchema, 'ip_assets');

async function diagnoseIpLinking() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  // 1) Build username maps
  const allUsers = await User.find({}).lean();
  const usernameToUser = {};
  
  for (const user of allUsers) {
    if (user.username) {
      usernameToUser[user.username] = {
        userId: user.id,
        name: user.name,
        _id: user._id
      };
      // Also map variations (with/without hyphens, case-insensitive)
      const normalized = user.username.toLowerCase().replace(/-/g, '');
      usernameToUser[normalized] = usernameToUser[user.username];
    }
  }

  console.log(`Found ${Object.keys(usernameToUser).length} username variations\n`);

  // 2) Build IP owner map
  const allIpAssets = await IpAsset.find({}).lean();
  const usernameToIp = {};
  
  console.log('IP Assets and their owners:');
  for (const ip of allIpAssets) {
    if (!ip.ownerId) continue;
    
    const owner = allUsers.find(u => u.id === ip.ownerId);
    if (owner && owner.username) {
      usernameToIp[owner.username] = {
        ipAssetId: ip._id,
        ipName: ip.name,
        ipId: ip.id
      };
      
      // Also map normalized version
      const normalized = owner.username.toLowerCase().replace(/-/g, '');
      usernameToIp[normalized] = usernameToIp[owner.username];
      
      console.log(`  - ${owner.username} → "${ip.name}"`);
    }
  }
  
  console.log(`\n${allIpAssets.length} IP assets mapped to ${Object.keys(usernameToIp).length} username variations\n`);

  // 3) Find products with 2+ username categories but no IP link
  const multiUsernameProducts = await Product.find({
    categories: { $exists: true },
    ipAssetId: null
  }).lean();

  console.log('=== Products with Multiple Usernames (No IP Link) ===\n');

  const matches = [];
  let checked = 0;

  for (const product of multiUsernameProducts) {
    const categories = product.categories || [];
    
    // Find which categories are usernames
    const usernamesOnProduct = [];
    for (const cat of categories) {
      const normalized = cat.toLowerCase().replace(/-/g, '');
      if (usernameToUser[normalized]) {
        usernamesOnProduct.push(cat);
      }
    }
    
    if (usernamesOnProduct.length < 2) continue;
    
    checked++;
    
    // Check which usernames have IP
    const ipOwners = [];
    const creators = [];
    
    for (const username of usernamesOnProduct) {
      const normalized = username.toLowerCase().replace(/-/g, '');
      if (usernameToIp[normalized]) {
        ipOwners.push({
          username,
          ip: usernameToIp[normalized]
        });
      } else {
        creators.push(username);
      }
    }
    
    if (ipOwners.length > 0) {
      matches.push({
        productId: product._id,
        productLegacyId: product.legacyProductId,
        title: product.title,
        currentUserId: product.userId,
        categories: categories,
        ipOwners: ipOwners,
        creators: creators
      });
      
      console.log(`Product: ${product.title}`);
      console.log(`  MongoDB _id: ${product._id}`);
      console.log(`  Legacy ID: ${product.legacyProductId}`);
      console.log(`  Current userId: ${product.userId || 'NOT SET'}`);
      console.log(`  Categories: ${categories.join(', ')}`);
      console.log(`  IP Owner(s):`);
      for (const owner of ipOwners) {
        console.log(`    - ${owner.username} → IP: "${owner.ip.ipName}" (${owner.ip.ipAssetId})`);
      }
      console.log(`  Product Creator(s): ${creators.join(', ')}`);
      console.log('');
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Products checked: ${checked}`);
  console.log(`Products that should link to IP: ${matches.length}`);
  
  // 4) Generate update script
  if (matches.length > 0) {
    console.log('\n=== Suggested MongoDB Updates ===\n');
    
    for (const match of matches) {
      if (match.ipOwners.length === 1 && match.creators.length === 1) {
        const ipOwner = match.ipOwners[0];
        const creator = match.creators[0];
        const creatorNormalized = creator.toLowerCase().replace(/-/g, '');
        const creatorData = usernameToUser[creatorNormalized];
        
        console.log(`db.products.updateOne(`);
        console.log(`  { _id: ObjectId("${match.productId}") },`);
        console.log(`  { $set: {`);
        console.log(`      ipAssetId: ObjectId("${ipOwner.ip.ipAssetId}"),`);
        if (creatorData) {
          console.log(`      userId: "${creatorData.userId}"`);
        }
        console.log(`  }}`);
        console.log(`);`);
        console.log('');
      } else {
        console.log(`// MANUAL REVIEW NEEDED: "${match.title}"`);
        console.log(`// Multiple IP owners (${match.ipOwners.length}) or creators (${match.creators.length})`);
        console.log(`// Product _id: ${match.productId}`);
        console.log('');
      }
    }
  }

  await mongoose.disconnect();
}

diagnoseIpLinking().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
