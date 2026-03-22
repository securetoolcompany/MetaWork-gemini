// SIMPLE MIGRATION: Add 'categories' field, keep 'tags' unchanged

// Step 1: Add empty 'categories' array to all documents
db.ip_assets.updateMany(
  {},
  { 
    $set: { categories: [] }  // NEW field for system categories
  }
);

// NOTE: 'tags' field is NOT touched! It stays exactly as-is.

// Step 2: Auto-categorize based on existing tags
// Example: If tags contain "nature", add "Nature" and "Photography" to categories

db.ip_assets.updateMany(
  { tags: { $regex: /nature/i } },
  { 
    $addToSet: { 
      categories: { $each: ["Photography", "Nature"] }
    }
    // tags field is UNCHANGED
  }
);

db.ip_assets.updateMany(
  { tags: { $regex: /urban/i } },
  { 
    $addToSet: { 
      categories: { $each: ["Photography", "Urban"] }
    }
  }
);

// Result:
// BEFORE: { tags: ["modern", "nature", "urban"], ... }
// AFTER:  { tags: ["modern", "nature", "urban"], categories: ["Photography", "Nature", "Urban"], ... }
//         ^^^^^ tags unchanged!        ^^^^^ new field added!

console.log("Done! 'tags' field unchanged, 'categories' field added.");