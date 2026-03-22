// filterExport.cjs - Updated with forced inclusion of specific users
const fs = require('fs');

console.log('🔄 Starting filter process...\n');

// The 25 user IDs that must be included (from your previous findings)
const MUST_INCLUDE_USER_IDS = [
  3264, 3480, 3522, 715, 3498, 4687, 4291, 3161, 2469, 829,
  3845, 3426, 3262, 4332, 3089, 3528, 3369, 3361, 3025, 4196,
  918, 698, 3303, 2659, 3665
];

// Load the export
console.log('📖 Reading JSON file...');
let exportData;
try {
  const fileContent = fs.readFileSync('metawork_complete_export_2026-01-25_21-20-36.json', 'utf8');
  console.log('✅ File loaded, parsing JSON...');
  exportData = JSON.parse(fileContent);
  console.log('✅ JSON parsed successfully!\n');
} catch (error) {
  console.error('❌ Error loading file:', error.message);
  process.exit(1);
}

console.log('📊 Original stats:');
console.log(`   Users:    ${exportData.users?.length || 0}`);
console.log(`   Aisles:   ${exportData.aisles?.length || 0}`);
console.log(`   Products: ${exportData.products?.length || 0}`);
console.log(`   Orders:   ${exportData.orders?.length || 0}\n`);

// Build map of username to user ID
const usersByLogin = new Map(exportData.users?.map(u => [u.login.toLowerCase(), u.id]) || []);
const usersByNicename = new Map(exportData.users?.map(u => [u.nicename.toLowerCase(), u.id]) || []);

// Build set of user IDs with REAL engagement only
console.log('🔍 Analyzing user engagement...');
const activeUserIds = new Set();

// FIRST: Add the must-include users
console.log(`\n   ⭐ Force-including ${MUST_INCLUDE_USER_IDS.length} previously missing users...`);
let forcedIncludeCount = 0;
MUST_INCLUDE_USER_IDS.forEach(userId => {
  const user = exportData.users?.find(u => u.id === userId);
  if (user) {
    activeUserIds.add(userId);
    forcedIncludeCount++;
  }
});
console.log(`      ✓ Force-included ${forcedIncludeCount} users`);

// 1. PRODUCT CREATORS - users whose category has actual products
console.log('\n   🛍️ Finding product creators...');
const creatorCategories = new Set();

exportData.products?.forEach(product => {
  product.categories?.forEach(cat => {
    creatorCategories.add(cat.slug.toLowerCase());
  });
});

let productCreatorCount = 0;
const productCreators = [];

creatorCategories.forEach(categorySlug => {
  let userId = usersByLogin.get(categorySlug) || usersByNicename.get(categorySlug);
  
  if (userId) {
    const user = exportData.users.find(u => u.id === userId);
    if (user && !activeUserIds.has(userId)) {
      productCreatorCount++;
      productCreators.push(user.login);
      activeUserIds.add(userId);
    }
  }
});

console.log(`      ✓ Found ${productCreatorCount} product creators with active products`);

// 2. Users who EDITED their aisle
console.log('\n   🏠 Finding edited aisles...');
let aisleEditCount = 0;
exportData.aisles?.forEach(aisle => {
  if (!aisle.author_id) return;
  
  const hasCustomContent = aisle.content && aisle.content.length > 100;
  const wasModified = aisle.modified !== aisle.date;
  const hasCustomMeta = aisle.meta?.background_color?.[0] || 
                        aisle.meta?.title_color?.[0] ||
                        aisle.meta?.profile_picture?.[0] ||
                        aisle.meta?.facebook_url?.[0] ||
                        aisle.meta?.instagram_url?.[0] ||
                        aisle.meta?.twitter_url?.[0];
  
  if (hasCustomContent || wasModified || hasCustomMeta) {
    if (!activeUserIds.has(aisle.author_id)) {
      aisleEditCount++;
    }
    activeUserIds.add(aisle.author_id);
  }
});
console.log(`      ✓ Found ${aisleEditCount} users with edited aisles`);

// 3. Users who placed orders
console.log('\n   🛒 Finding customers with orders...');
let orderCount = 0;
exportData.orders?.forEach(order => {
  if (order.customer_id) {
    if (!activeUserIds.has(order.customer_id)) {
      orderCount++;
    }
    activeUserIds.add(order.customer_id);
  }
});
console.log(`      ✓ Found ${orderCount} customers with orders`);

// 4. LUMISE IP CREATORS
console.log('\n   🎨 Finding Lumise IP creators...');
const lumiseCategories = new Set();

exportData.lumise?.images?.forEach(image => {
  if (image.categories) {
    let cats = image.categories;
    if (typeof cats === 'string') {
      try {
        cats = JSON.parse(cats);
      } catch (e) {
        cats = cats.split(',').map(c => c.trim());
      }
    }
    if (Array.isArray(cats)) {
      cats.forEach(catId => {
        const category = exportData.lumise?.categories?.find(c => c.id == catId);
        if (category?.name) {
          lumiseCategories.add(category.name.toLowerCase());
        }
      });
    }
  }
});

let lumiseCreatorCount = 0;
lumiseCategories.forEach(categoryName => {
  let userId = usersByLogin.get(categoryName) || usersByNicename.get(categoryName);
  
  if (userId && !activeUserIds.has(userId)) {
    lumiseCreatorCount++;
    activeUserIds.add(userId);
  }
});
console.log(`      ✓ Found ${lumiseCreatorCount} Lumise IP creators`);

// 5. Check user metadata
console.log('\n   👤 Finding users with profile customizations...');
let profilePicCount = 0;
let bioCount = 0;
let socialCount = 0;

exportData.users?.forEach(user => {
  const meta = user.meta || {};
  let addedThisUser = false;
  
  if (meta.profile_picture?.[0] || meta.wpforo_avatar?.[0]) {
    if (!activeUserIds.has(user.id)) { profilePicCount++; addedThisUser = true; }
    activeUserIds.add(user.id);
  }
  
  if (!addedThisUser && meta.description?.[0] && meta.description[0].trim().length > 10) {
    if (!activeUserIds.has(user.id)) { bioCount++; addedThisUser = true; }
    activeUserIds.add(user.id);
  }
  
  if (!addedThisUser && (meta.facebook_url?.[0] || meta.instagram_url?.[0] || meta.twitter_url?.[0])) {
    if (!activeUserIds.has(user.id)) { socialCount++; }
    activeUserIds.add(user.id);
  }
});
console.log(`      ✓ Found ${profilePicCount} with profile pics`);
console.log(`      ✓ Found ${bioCount} with bios`);
console.log(`      ✓ Found ${socialCount} with social links`);

// Filter
console.log('\n🔧 Filtering data...');
const filteredUsers = exportData.users?.filter(user => activeUserIds.has(user.id)) || [];
const filteredAisles = exportData.aisles?.filter(aisle => activeUserIds.has(aisle.author_id)) || [];

const filtered = {
  ...exportData,
  users: filteredUsers,
  aisles: filteredAisles,
  stats: {
    ...exportData.stats,
    original_users: exportData.users?.length || 0,
    active_users_kept: filteredUsers.length,
    forced_included: forcedIncludeCount,
    spam_users_removed: (exportData.users?.length || 0) - filteredUsers.length,
    original_aisles: exportData.aisles?.length || 0,
    active_aisles_kept: filteredAisles.length,
  }
};

// Save
console.log('💾 Saving filtered export...');
fs.writeFileSync(
  'metawork_filtered_export.json',
  JSON.stringify(filtered, null, 2),
  'utf8'
);

const originalSize = (fs.statSync('metawork_complete_export_2026-01-25_21-20-36.json').size / 1024 / 1024).toFixed(1);
const filteredSize = (fs.statSync('metawork_filtered_export.json').size / 1024 / 1024).toFixed(1);

console.log('\n✅ DONE! Filtered export stats:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Users:        ${exportData.users?.length || 0} → ${filteredUsers.length} (removed ${(exportData.users?.length || 0) - filteredUsers.length})`);
console.log(`  - Forced:   ${forcedIncludeCount} previously missing users`);
console.log(`Aisles:       ${exportData.aisles?.length || 0} → ${filteredAisles.length}`);
console.log(`File size:    ${originalSize}MB → ${filteredSize}MB`);
console.log(`Spam removed: ${((((exportData.users?.length || 0) - filteredUsers.length) / (exportData.users?.length || 1)) * 100).toFixed(1)}%`);
console.log('\n📄 Saved to: metawork_filtered_export.json');
