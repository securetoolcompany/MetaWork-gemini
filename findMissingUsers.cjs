// findMissingUsers.cjs
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("metawork_complete_export_2026-01-25_21-20-36.json", "utf8"));

const missingIds = [
  698, 715, 829, 918, 2469, 2659,
  3025, 3047, 3089, 3161, 3262, 3264,
  3303, 3352, 3353, 3361, 3369, 3426,
  3480, 3498, 3522, 3528, 3665, 3845,
  3908, 4196, 4291, 4332, 4513, 4514,
  4515, 4516, 4517, 4687, 4762, 6183
];

console.log("Looking for users in the export...\n");

// Check if they exist in the users array
const foundUsers = data.users.filter(u => missingIds.includes(u.id));
const foundIds = new Set(foundUsers.map(u => u.id));

console.log(`Found ${foundUsers.length} of ${missingIds.length} users in the export:\n`);

if (foundUsers.length > 0) {
  foundUsers.forEach(u => {
    console.log(`  ID ${u.id}: ${u.login} (${u.email})`);
  });
}

const notInExport = missingIds.filter(id => !foundIds.has(id));
console.log(`\n${notInExport.length} user IDs NOT in the export (filtered out):`);
console.log(notInExport);

console.log("\n--- Summary ---");
console.log(`These ${notInExport.length} users were excluded from your filtered export.`);
console.log(`Their aisles exist but can't be migrated without user records.`);
