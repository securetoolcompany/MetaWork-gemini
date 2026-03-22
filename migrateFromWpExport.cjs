/**
 * scripts/migrateFromWpExport.cjs
 *
 * Optimized version with batch operations
 * Run with: node migrateFromWpExport.cjs
 */

require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error('MONGO_URI or MONGODB_URI is not set in .env');
}

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// ---------- CONFIG ----------

const EXPORT_PATH = path.join(
  process.cwd(),
  'metawork_complete_export_2026-01-25_21-20-36.json'
);

// ---------- MODELS ----------

const UserSchema = new Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');

const ProductSchema = new Schema({}, { strict: false });
const Product = mongoose.model('Product', ProductSchema, 'products');

const IpAssetSchema = new Schema({}, { strict: false });
const IpAsset = mongoose.model('IpAsset', IpAssetSchema, 'ip_assets');

const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    productLegacyId: Number,
    title: String,
    quantity: Number,
    unitPrice: Number,
    lineTotal: Number,
    variant: {
      size: String,
      color: String,
    },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    legacyOrderId: { type: Number, unique: true, index: true },
    orderNumber: String,
    buyerUserId: { type: String, default: null },
    legacyCustomerId: { type: Number, default: null },
    customerEmail: { type: String, default: null },
    status: String,
    total: Number,
    subtotal: Number,
    taxTotal: Number,
    shippingTotal: Number,
    dateCreated: Date,
    datePaid: Date,
    items: [OrderItemSchema],
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', OrderSchema, 'orders');

// ---------- UTILS ----------

function toNumber(val, fallback = 0) {
  if (val == null) return fallback;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return Number.isNaN(n) ? fallback : n;
}

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function generateProductId(wpProduct) {
  return `prod_${wpProduct.slug}_${wpProduct.id}`;
}

// Extract WordPress user ID from internal user.id format: user_username_WPID
function extractWpIdFromUserId(userId) {
  if (!userId || typeof userId !== 'string') return null;
  const match = userId.match(/_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

// ---------- BATCH OPERATIONS ----------

/**
 * Backfill legacyUserId on existing users in batch
 */
async function backfillLegacyUsers(wpUsers) {
  console.log('\n=== Backfilling legacyUserId on users (batch) ===');
  
  // Load all existing users at once
  const allUsers = await User.find({}).lean();
  
  // Build maps for fast lookup
  const emailToUser = {};
  const loginToUser = {};
  const legacyIdToUser = {};
  
  for (const user of allUsers) {
    if (user.email) emailToUser[user.email] = user;
    if (user.id) loginToUser[user.id] = user;
    if (user.legacyUserId) legacyIdToUser[user.legacyUserId] = user;
  }
  
  console.log(`Loaded ${allUsers.length} existing users from MongoDB.`);
  
  const bulkOps = [];
  
  for (const wpUser of wpUsers) {
    // Find match
    let matchedUser = legacyIdToUser[wpUser.id] || 
                      emailToUser[wpUser.email] || 
                      loginToUser[wpUser.login];
    
    if (!matchedUser) continue;
    
    // Only update if legacyUserId is missing or different
    if (matchedUser.legacyUserId !== wpUser.id) {
      bulkOps.push({
        updateOne: {
          filter: { _id: matchedUser._id },
          update: { $set: { legacyUserId: wpUser.id } }
        }
      });
    }
  }
  
  if (bulkOps.length > 0) {
    const result = await User.bulkWrite(bulkOps);
    console.log(`Updated legacyUserId on ${result.modifiedCount} users.`);
  } else {
    console.log('No users needed legacyUserId updates.');
  }
}

/**
 * Import products from WordPress export
 */
async function importProducts(wpProducts, usernameToUserId) {
  console.log('\n=== Importing products from export ===');
  
  // Check which products already exist
  const existingProducts = await Product.find({}).lean();
  const existingLegacyIds = new Set(
    existingProducts
      .map(p => p.legacyProductId)
      .filter(id => id != null)
  );
  
  console.log(`Found ${existingProducts.length} existing products in MongoDB.`);
  console.log(`${existingLegacyIds.size} already have legacyProductId.`);
  
  const bulkOps = [];
  let newProducts = 0;
  let skippedExisting = 0;
  
  for (const wpProduct of wpProducts) {
    // Skip if already imported
    if (existingLegacyIds.has(wpProduct.id)) {
      skippedExisting++;
      continue;
    }
    
    // Extract username categories
    const categories = (wpProduct.categories || []).map(c => c.name);
    
    // Try to find the product owner from categories
    let userId = null;
    for (const cat of categories) {
      if (usernameToUserId[cat]) {
        userId = usernameToUserId[cat];
        break; // Use first matching username
      }
    }
    
    // Build mockup images array from gallery
    const mockupImages = (wpProduct.gallery_images || []).map(img => img.url);
    if (wpProduct.featured_image_url && !mockupImages.includes(wpProduct.featured_image_url)) {
      mockupImages.unshift(wpProduct.featured_image_url);
    }
    
    const productDoc = {
      id: generateProductId(wpProduct),
      legacyProductId: wpProduct.id,
      userId: userId, // Will be refined in linkProductsToOwnersAndIp
      
      title: wpProduct.title,
      description: wpProduct.description || '',
      slug: wpProduct.slug,
      
      price: toNumber(wpProduct.price),
      regularPrice: toNumber(wpProduct.regular_price),
      salePrice: wpProduct.sale_price ? toNumber(wpProduct.sale_price) : null,
      
      categories: categories,
      tags: (wpProduct.tags || []).map(t => typeof t === 'string' ? t : t.name),
      
      thumbnailUrl: wpProduct.featured_image_url || null,
      mockupImages: mockupImages,
      
      status: wpProduct.status === 'publish' ? 'active' : 'draft',
      isPublic: wpProduct.status === 'publish',
      
      stockStatus: wpProduct.stock_status || 'instock',
      
      // Printful data
      externalProductId: wpProduct.printful?.product_id || null,
      printfulData: wpProduct.printful || {},
      
      // Metadata
      variations: wpProduct.variations || [],
      attributes: wpProduct.attributes || [],
      
      sales: 0, // Will be computed from orders
      views: 0,
      
      createdAt: toDate(wpProduct.date) || new Date(),
      updatedAt: toDate(wpProduct.modified) || new Date(),
      
      source: 'wp_export'
    };
    
    bulkOps.push({
      insertOne: {
        document: productDoc
      }
    });
    
    newProducts++;
  }
  
  console.log(`\nProducts to import: ${newProducts}`);
  console.log(`Skipped (already exist): ${skippedExisting}`);
  
  if (bulkOps.length > 0) {
    const result = await Product.bulkWrite(bulkOps, { ordered: false });
    console.log(`Inserted ${result.insertedCount} new products.`);
  }
}

/**
 * Link products to creators and IP owners based on username categories
 */
async function linkProductsToOwnersAndIp() {
  console.log('\n=== Linking Products to Owners and IP ===');
  
  // Build maps in batch
  const allUsers = await User.find({}).lean();
  const usernameToUser = {};
  
  for (const user of allUsers) {
    if (user.username) {
      usernameToUser[user.username] = {
        userId: user.id,
        mongoId: user._id,
      };
    }
  }
  
  console.log(`Built username map with ${Object.keys(usernameToUser).length} usernames.`);
  
  const allIpAssets = await IpAsset.find({}).lean();
  const usernameToIpAsset = {};
  
  for (const ipAsset of allIpAssets) {
    if (!ipAsset.ownerId) continue;
    const owner = allUsers.find(u => u.id === ipAsset.ownerId);
    if (owner && owner.username) {
      usernameToIpAsset[owner.username] = ipAsset._id;
    }
  }
  
  console.log(`Built IP map with ${Object.keys(usernameToIpAsset).length} IP-owning usernames.`);
  
  // Process all products in batch
  const allProducts = await Product.find({}).lean();
  const bulkOps = [];
  
  let withOneUsername = 0;
  let withMultipleUsernames = 0;
  let withIpLinked = 0;
  let withCreatorLinked = 0;
  let noUsernamesFound = 0;
  
  for (const product of allProducts) {
    const categories = product.categories || [];
    const usernamesOnProduct = categories.filter(cat => usernameToUser[cat]);
    
    if (usernamesOnProduct.length === 0) {
      noUsernamesFound++;
      continue;
    }
    
    const updates = {};
    
    if (usernamesOnProduct.length === 1) {
      // Single username → product owner, no IP
      const username = usernamesOnProduct[0];
      const userData = usernameToUser[username];
      
      if (product.userId !== userData.userId) {
        updates.userId = userData.userId;
        withCreatorLinked++;
      }
      
      if (product.ipAssetId !== null) {
        updates.ipAssetId = null;
      }
      
      withOneUsername++;
      
    } else {
      // Multiple usernames → split IP owner vs product owner
      const ipUsernames = usernamesOnProduct.filter(u => usernameToIpAsset[u]);
      const creatorUsernames = usernamesOnProduct.filter(u => !usernameToIpAsset[u]);
      
      if (ipUsernames.length === 1) {
        const ipAssetId = usernameToIpAsset[ipUsernames[0]];
        if (!product.ipAssetId || product.ipAssetId.toString() !== ipAssetId.toString()) {
          updates.ipAssetId = ipAssetId;
          withIpLinked++;
        }
      }
      
      if (creatorUsernames.length === 1) {
        const userData = usernameToUser[creatorUsernames[0]];
        if (product.userId !== userData.userId) {
          updates.userId = userData.userId;
          withCreatorLinked++;
        }
      }
      
      withMultipleUsernames++;
    }
    
    if (Object.keys(updates).length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: updates }
        }
      });
    }
  }
  
  console.log(`\nProducts analyzed: ${allProducts.length}`);
  console.log(`  With 1 username (no IP): ${withOneUsername}`);
  console.log(`  With 2+ usernames: ${withMultipleUsernames}`);
  console.log(`  No username categories: ${noUsernamesFound}`);
  console.log(`\nLinks to set:`);
  console.log(`  IP links: ${withIpLinked}`);
  console.log(`  Creator links: ${withCreatorLinked}`);
  
  if (bulkOps.length > 0) {
    const result = await Product.bulkWrite(bulkOps);
    console.log(`\nUpdated ${result.modifiedCount} products.`);
  } else {
    console.log('\nNo updates needed.');
  }
}

/**
 * Migrate orders in batch
 */
async function migrateOrders(wpOrders) {
  console.log('\n=== Migrating orders ===');
  
  // Build lookup maps in batch
  const allUsers = await User.find({}).lean();
  const legacyIdToUser = {};
  
  for (const user of allUsers) {
    const wpId = extractWpIdFromUserId(user.id);
    if (wpId) legacyIdToUser[wpId] = user;
    if (user.legacyUserId) legacyIdToUser[user.legacyUserId] = user;
  }
  
  const allProducts = await Product.find({}).lean();
  const legacyIdToProduct = {};
  
  for (const product of allProducts) {
    if (product.legacyProductId) {
      legacyIdToProduct[product.legacyProductId] = product;
    }
  }
  
  console.log(`Mapped ${Object.keys(legacyIdToUser).length} legacy user IDs.`);
  console.log(`Mapped ${Object.keys(legacyIdToProduct).length} legacy product IDs.`);
  
  // Check existing orders
  const existingOrders = await Order.find({}, { legacyOrderId: 1 }).lean();
  const existingLegacyIds = new Set(existingOrders.map(o => o.legacyOrderId));
  
  const bulkOps = [];
  let created = 0;
  let skipped = 0;
  
  for (const wpOrder of wpOrders) {
    if (existingLegacyIds.has(wpOrder.id)) {
      skipped++;
      continue;
    }
    
    let buyerUserId = null;
    let legacyCustomerId = null;
    
    if (wpOrder.customer_id != null) {
      const user = legacyIdToUser[wpOrder.customer_id];
      if (user) {
        buyerUserId = user.id || user._id.toString();
      }
      legacyCustomerId = wpOrder.customer_id;
    }
    
    const items = [];
    for (const item of wpOrder.items || []) {
      const productLegacyId = item.product_id;
      const product = legacyIdToProduct[productLegacyId];
      
      const quantity = toNumber(item.quantity, 1);
      const lineTotal = toNumber(item.total, 0);
      const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;
      
      items.push({
        productId: product ? product._id : null,
        productLegacyId,
        title: item.name,
        quantity,
        unitPrice,
        lineTotal,
        variant: { size: null, color: null },
      });
    }
    
    if (items.length === 0) continue;
    
    const orderDoc = {
      legacyOrderId: wpOrder.id,
      orderNumber: wpOrder.order_number,
      buyerUserId,
      legacyCustomerId,
      customerEmail: wpOrder.customer_email || null,
      status: wpOrder.status,
      total: toNumber(wpOrder.total),
      subtotal: toNumber(wpOrder.subtotal),
      taxTotal: toNumber(wpOrder.tax_total),
      shippingTotal: toNumber(wpOrder.shipping_total),
      dateCreated: toDate(wpOrder.date_created) || new Date(),
      datePaid: toDate(wpOrder.date_paid),
      items,
      source: 'wp_export',
    };
    
    bulkOps.push({
      insertOne: { document: orderDoc }
    });
    
    created++;
  }
  
  console.log(`\nOrders to create: ${created}`);
  console.log(`Skipped (already exist): ${skipped}`);
  
  if (bulkOps.length > 0) {
    const result = await Order.bulkWrite(bulkOps, { ordered: false });
    console.log(`Inserted ${result.insertedCount} orders.`);
  }
}

/**
 * Recompute product sales from orders
 */
async function recomputeProductSales() {
  console.log('\n=== Recomputing product sales ===');
  
  const results = await Order.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.productId': { $ne: null } } },
    {
      $group: {
        _id: '$items.productId',
        totalQty: { $sum: '$items.quantity' },
      },
    },
  ]);
  
  if (results.length === 0) {
    console.log('No sales data to compute.');
    return;
  }
  
  const bulkOps = results.map(row => ({
    updateOne: {
      filter: { _id: row._id },
      update: { $set: { sales: row.totalQty } }
    }
  }));
  
  const result = await Product.bulkWrite(bulkOps);
  console.log(`Updated sales for ${result.modifiedCount} products.`);
}

// ---------- MAIN ----------

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected\n');
  
  console.log(`Loading export: ${EXPORT_PATH}`);
  const raw = fs.readFileSync(EXPORT_PATH, 'utf-8');
  const data = JSON.parse(raw);
  
  const wpUsers = data.users || [];
  const wpProducts = data.products || [];
  const wpOrders = data.orders || [];
  
  console.log(`\nExport contains:`);
  console.log(`  Users: ${wpUsers.length}`);
  console.log(`  Products: ${wpProducts.length}`);
  console.log(`  Orders: ${wpOrders.length}`);
  
  // Build username map early for product import
  const allUsers = await User.find({}).lean();
  const usernameToUserId = {};
  for (const user of allUsers) {
    if (user.username) {
      usernameToUserId[user.username] = user.id;
    }
  }
  
  // Execute migration steps
  await backfillLegacyUsers(wpUsers);
  await importProducts(wpProducts, usernameToUserId);
  await linkProductsToOwnersAndIp();
  await migrateOrders(wpOrders);
  await recomputeProductSales();
  
  console.log('\n✅ Migration complete!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
