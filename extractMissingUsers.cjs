// extractMissingUsers.cjs - FIXED VERSION
const fs = require('fs');

// The 25 missing user IDs from your findMissingUsers output
const missingUserIds = [
  3264, 3480, 3522, 715, 3498, 4687, 4291, 3161, 2469, 829,
  3845, 3426, 3262, 4332, 3089, 3528, 3369, 3361, 3025, 4196,
  918, 698, 3303, 2659, 3665
];

console.log('Reading original WordPress export...');

const exportData = JSON.parse(
  fs.readFileSync('./metawork_complete_export_2026-01-25_21-20-36.json', 'utf8')
);

let originalExport;
if (Array.isArray(exportData)) {
  originalExport = exportData;
} else if (exportData.users) {
  originalExport = exportData.users;
} else if (exportData.data && exportData.data.users) {
  originalExport = exportData.data.users;
} else {
  console.log('Export structure:', Object.keys(exportData));
  throw new Error('Could not find users array in export');
}

console.log(`Total users in original export: ${originalExport.length}`);

const missingUsers = originalExport.filter(user => 
  missingUserIds.includes(parseInt(user.id) || parseInt(user.ID))
);

console.log(`\nFound ${missingUsers.length} missing users\n`);

if (missingUsers.length === 0) {
  console.log('No users found. Sample of first user structure:');
  console.log(JSON.stringify(originalExport[0], null, 2));
  process.exit(1);
}

// Transform to match your MongoDB schema
const transformedUsers = missingUsers.map(user => {
  // Extract the correct username field
  const username = user.username || user.user_login || user.user_nicename || `user${user.id || user.ID}`;
  const userId = user.id || user.ID;
  
  return {
    id: `user_${username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${userId}`,
    name: user.name || user.display_name || username,
    email: user.email || user.user_email || '',
    username: username, // This must not be null
    bio: user.bio || user.description || '',
    tagline: user.tagline || '',
    location: user.location || '',
    website: user.website || user.user_url || '',
    avatar: user.avatar || '',
    banner: user.banner || '',
    contactEmail: user.contactEmail || user.email || user.user_email || '',
    phone: user.phone || '',
    socialLinks: user.socialLinks || {},
    aisleSettings: user.aisleSettings || {},
    password: user.password || user.user_pass || '',
    authMethod: user.authMethod || 'email',
    membershipTier: user.membershipTier || 'free',
    role: user.role || (user.roles && user.roles[0]) || 'creator',
    verified: user.verified || false,
    stats: user.stats || {},
    preferences: user.preferences || {},
    wallets: user.wallets || [],
    createdAt: user.createdAt || user.user_registered || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString()
  };
});

// Check for any null usernames before saving
const nullUsernames = transformedUsers.filter(u => !u.username);
if (nullUsernames.length > 0) {
  console.error('ERROR: Found users with null usernames:');
  nullUsernames.forEach(u => console.error(`  - ${u.name} (${u.email})`));
  process.exit(1);
}

fs.writeFileSync(
  './missing-users-import.json',
  JSON.stringify(transformedUsers, null, 2)
);

console.log('✓ Saved to missing-users-import.json');
console.log('\nMissing users found:');
transformedUsers.forEach(user => {
  console.log(`  - ${user.name} (@${user.username}) (${user.email})`);
});

console.log('\n\nNext steps:');
console.log('1. Review missing-users-import.json');
console.log('2. Run: node importMissingUsers.cjs');
