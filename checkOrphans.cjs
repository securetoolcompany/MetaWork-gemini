// checkOrphans.cjs
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("metawork_filtered_export.json", "utf8"));

const userIds = new Set(data.users.map(u => u.id));
const aisleAuthorIds = [...new Set(data.aisles.map(a => parseInt(a.author_id)))];

const missingUserIds = aisleAuthorIds.filter(id => !userIds.has(id));

console.log(`Missing ${missingUserIds.length} user IDs:`);
console.log(missingUserIds.sort((a,b) => a-b));
