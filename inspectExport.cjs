// inspectExport.js
const fs = require("fs");

// Load JSON
const raw = fs.readFileSync("metawork_filtered_export.json", "utf8");
const data = JSON.parse(raw);

// Top-level keys
console.log("Top-level keys:");
console.log(Object.keys(data));

// Users summary
console.log("\nUsers summary:");
console.log({
  total: Array.isArray(data.users) ? data.users.length : 0,
  sample: data.users && data.users[0]
    ? {
        id: data.users[0].id,
        login: data.users[0].login,
        email: data.users[0].email,
      }
    : null,
});

// Aisles summary
console.log("\nAisles summary:");
const aisle = Array.isArray(data.aisles) && data.aisles[0] ? data.aisles[0] : null;
console.log(
  aisle
    ? {
        id: aisle.id,
        title: aisle.title,
        slug: aisle.slug,
        author_id: aisle.author_id,
        metaKeys: Object.keys(aisle.meta || {}),
      }
    : { total: 0 }
);

// Product categories summary
console.log("\nProduct categories summary:");
const cat = Array.isArray(data.product_categories) && data.product_categories[0]
  ? data.product_categories[0]
  : null;
console.log(
  cat
    ? {
        total: data.product_categories.length,
        sample: {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          parent: cat.parent,
        },
      }
    : { total: 0 }
);

// Products summary
console.log("\nProducts summary:");
const product = Array.isArray(data.products) && data.products[0] ? data.products[0] : null;
console.log(
  product
    ? {
        total: data.products.length,
        sample: {
          id: product.id,
          name: product.name || product.title,
          slug: product.slug,
          // if categories field exists on product, show just ids
          categories: product.categories || product.category_ids || undefined,
        },
      }
    : { total: 0 }
);

// Orders summary
console.log("\nOrders summary:");
const order = Array.isArray(data.orders) && data.orders[0] ? data.orders[0] : null;
console.log(
  order
    ? {
        total: data.orders.length,
        sample: {
          id: order.id,
          customer_id:
            order.customer_id || order.customer_user || order.user_id || null,
          line_items: Array.isArray(order.line_items)
            ? order.line_items.slice(0, 3).map((li) => ({
                product_id: li.product_id,
                qty: li.quantity,
              }))
            : null,
        },
      }
    : { total: 0 }
);

// Lumise summary (IP system)
console.log("\nLumise summary:");
if (data.lumise && typeof data.lumise === "object") {
  const lumiseKeys = Object.keys(data.lumise);
  console.log({ keys: lumiseKeys });

  const lumiseCategories =
    data.lumise.categories ||
    data.lumise.category ||
    data.lumise.cats ||
    null;

  if (Array.isArray(lumiseCategories) && lumiseCategories.length) {
    const lc = lumiseCategories[0];
    console.log("Lumise categories sample:", {
      total: lumiseCategories.length,
      sample: {
        id: lc.id,
        name: lc.name,
        slug: lc.slug,
        parent: lc.parent,
      },
    });
  } else {
    console.log("No Lumise category array detected.");
  }
} else {
  console.log("No lumise object present.");
}
