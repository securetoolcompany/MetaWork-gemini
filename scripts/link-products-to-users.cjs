require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

// Enhanced matching function - normalizes strings for comparison
function normalizeForMatching(str) {
  return str
    .toLowerCase()
    .replace(/[&]/g, 'and')           // & → and
    .replace(/[^a-z0-9]/g, '')        // Remove all non-alphanumeric (spaces, dashes, etc)
    .trim();
}

async function linkProductsToUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('metawork_db');
    
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    console.log(`\n📊 Found ${users.length} users`);
    
    // Create TWO maps - one for exact match, one for normalized
    const userMapExact = new Map();
    const userMapNormalized = new Map();
    
    users.forEach(user => {
      if (user.username) {
        const lower = user.username.toLowerCase();
        const normalized = normalizeForMatching(user.username);
        
        userMapExact.set(lower, user);
        userMapNormalized.set(normalized, user);
        
        // Debug: show some examples
        if (users.indexOf(user) < 5) {
          console.log(`   "${user.username}" → exact: "${lower}", normalized: "${normalized}"`);
        }
      }
    });
    
    console.log(`\n🔗 Mapping products to users by category...\n`);
    
    // Get all products with null userId
    const products = await db.collection('products')
      .find({ userId: null })
      .toArray();
    
    console.log(`📦 Found ${products.length} products without userId\n`);
    
    let updatedCount = 0;
    let notFoundCategories = new Set();
    let matchStats = {
      exact: 0,
      normalized: 0
    };
    
    for (const product of products) {
      if (!product.categories || product.categories.length === 0) {
        continue;
      }
      
      // Try to match any category to a username
      let matchedUser = null;
      let matchType = null;
      
      for (const category of product.categories) {
        const categoryLower = category.toLowerCase();
        const categoryNormalized = normalizeForMatching(category);
        
        // Try exact match first
        if (userMapExact.has(categoryLower)) {
          matchedUser = userMapExact.get(categoryLower);
          matchType = 'exact';
          break;
        }
        
        // Try normalized match (removes spaces, dashes, &, etc)
        if (userMapNormalized.has(categoryNormalized)) {
          matchedUser = userMapNormalized.get(categoryNormalized);
          matchType = 'normalized';
          break;
        }
      }
      
      if (matchedUser) {
        // Update product with userId
        const userId = matchedUser.id || matchedUser._id.toString();
        
        await db.collection('products').updateOne(
          { _id: product._id },
          { 
            $set: { 
              userId: userId,
              creatorId: userId // Set both for compatibility
            } 
          }
        );
        
        updatedCount++;
        matchStats[matchType]++;
        
        const productName = (product.title || product.name || 'Untitled').substring(0, 50);
        console.log(`✅ [${matchType}] ${productName} → @${matchedUser.username}`);
      } else {
        // No matching user found
        notFoundCategories.add(product.categories.join(', '));
      }
    }
    
    console.log(`\n✨ Successfully updated ${updatedCount} products`);
    console.log(`   - ${matchStats.exact} exact matches`);
    console.log(`   - ${matchStats.normalized} normalized matches (fuzzy)`);
    
    if (notFoundCategories.size > 0) {
      console.log(`\n⚠️  ${notFoundCategories.size} products with categories that don't match any username:`);
      const categoriesArray = Array.from(notFoundCategories);
      categoriesArray.slice(0, 10).forEach(cat => console.log(`   - ${cat}`));
      if (categoriesArray.length > 10) {
        console.log(`   ... and ${categoriesArray.length - 10} more`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

linkProductsToUsers();
