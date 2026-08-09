// backfill-legacy-external-product-id.cjs
// Copies legacyMetadata._smpf_external_product_id onto a top-level
// externalProductId field for legacy (WooCommerce-origin) products that are
// missing it. This is what /my-products and app/api/printful/edm-nonce
// rely on to open these products in the EDM.
//
// Usage:
//   node backfill-legacy-external-product-id.cjs

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const PRINTFUL_API_URL = 'https://api.printful.com';
const WRITE_MODE = process.argv.includes('--write');

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const LEGACY_STORE_ID =
  process.env.PRINTFUL_LEGACY_STORE_ID ||
  process.env.PRINTFUL_STORE_ID_SECONDARY;

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is missing from .env.local');
}

if (!PRINTFUL_API_KEY) {
  throw new Error('PRINTFUL_API_KEY is missing from .env.local');
}

if (!LEGACY_STORE_ID) {
  throw new Error(
    'Set PRINTFUL_LEGACY_STORE_ID or PRINTFUL_STORE_ID_SECONDARY in .env.local'
  );
}

function normalizeId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim().replace(/^#/, '');
}

async function printfulRequest(path) {
  const response = await fetch(`${PRINTFUL_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${PRINTFUL_API_KEY}`,
      'X-PF-Store-Id': String(LEGACY_STORE_ID),
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `Printful ${response.status}: ${
        payload?.error?.message || payload?.message || 'Unknown error'
      }`
    );
  }

  return payload.result;
}

async function getAllLegacySyncProducts() {
  const products = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const result = await printfulRequest(
      `/store/products?limit=${limit}&offset=${offset}`
    );

    const page = Array.isArray(result) ? result : [];

    products.push(...page);

    if (page.length < limit) {
      break;
    }

    offset += limit;
  }

  return products;
}

async function getLegacySyncProduct(syncProductId) {
  return printfulRequest(`/store/products/${syncProductId}`);
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();

    const db = process.env.MONGODB_DB_NAME
      ? client.db(process.env.MONGODB_DB_NAME)
      : client.db();

    console.log(`\nMode: ${WRITE_MODE ? 'WRITE' : 'DRY RUN'}`);
    console.log(`Legacy Printful store: ${LEGACY_STORE_ID}`);
    console.log('Loading legacy Printful synced products...\n');

    const legacySyncProducts = await getAllLegacySyncProducts();

    const syncProductByExternalId = new Map(
      legacySyncProducts
        .filter((product) => normalizeId(product.external_id))
        .map((product) => [normalizeId(product.external_id), product])
    );

    console.log(
      `Loaded ${legacySyncProducts.length} synced products from the legacy store.\n`
    );

    const unresolvedProducts = await db
      .collection('products')
      .find({
        legacyMetadata: { $exists: true },
        $or: [
          { externalProductId: { $exists: false } },
          { externalProductId: null },
          { externalProductId: '' },
        ],
      })
      .project({
        _id: 1,
        title: 1,
        name: 1,
        printfulTemplateId: 1,
        variations: 1,
      })
      .toArray();

    console.log(
      `Found ${unresolvedProducts.length} unresolved legacy Mongo products.\n`
    );

    let recoveredProducts = 0;
    let missingProducts = 0;
    let recoveredVariants = 0;
    let missingVariants = 0;

    for (const product of unresolvedProducts) {
      const title = product.title || product.name || String(product._id);
      const legacyWooProductId = normalizeId(product.printfulTemplateId);

      if (!legacyWooProductId) {
        missingProducts += 1;
        console.log(`✗ ${title} — missing legacy WooCommerce product ID`);
        continue;
      }

      const listItem = syncProductByExternalId.get(legacyWooProductId);

      if (!listItem?.id) {
        missingProducts += 1;
        console.log(
          `✗ ${title} — WooCommerce product #${legacyWooProductId} was not found in legacy Printful store`
        );
        continue;
      }

      const syncProduct = await getLegacySyncProduct(listItem.id);
      const printfulSyncProductId = Number(
        syncProduct?.sync_product?.id || listItem.id
      );

      const syncVariants = Array.isArray(syncProduct?.sync_variants)
        ? syncProduct.sync_variants
        : [];

      const syncVariantByExternalId = new Map(
        syncVariants
          .filter((variant) => normalizeId(variant.external_id))
          .map((variant) => [
            normalizeId(variant.external_id),
            variant,
          ])
      );

      const updateFields = {
        externalProductId: legacyWooProductId,
        printfulSyncProductId,
        'legacyMetadata.legacyWooProductId': legacyWooProductId,
        'legacyMetadata.legacyPrintfulStoreId': String(LEGACY_STORE_ID),
        'legacyMetadata.recoveredFromLegacyStore': true,
        'legacyMetadata.needsManualResync': false,
      };

      let productRecoveredVariants = 0;
      let productMissingVariants = 0;

      for (const [index, variation] of (product.variations || []).entries()) {
        const legacyWooVariationId = normalizeId(variation.id);
        const matchedSyncVariant = syncVariantByExternalId.get(
          legacyWooVariationId
        );

        if (!matchedSyncVariant?.id) {
          productMissingVariants += 1;
          continue;
        }

        updateFields[`variations.${index}.printfulSyncVariantId`] = Number(
          matchedSyncVariant.id
        );

        updateFields[`variations.${index}.printfulCatalogVariantId`] = Number(
          matchedSyncVariant.variant_id
        );

        productRecoveredVariants += 1;
      }

      recoveredProducts += 1;
      recoveredVariants += productRecoveredVariants;
      missingVariants += productMissingVariants;

      console.log(
        `✓ ${title}\n` +
          `  Woo product: #${legacyWooProductId}\n` +
          `  Printful sync product: ${printfulSyncProductId}\n` +
          `  Variants recovered: ${productRecoveredVariants}/${product.variations?.length || 0}`
      );

      if (productMissingVariants > 0) {
        console.log(
          `  ⚠ ${productMissingVariants} variation(s) did not match a legacy Printful sync variant`
        );
      }

      if (WRITE_MODE) {
        await db.collection('products').updateOne(
          { _id: product._id },
          {
            $set: updateFields,
          }
        );
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Products recovered: ${recoveredProducts}`);
    console.log(`Products not found in legacy store: ${missingProducts}`);
    console.log(`Variants recovered: ${recoveredVariants}`);
    console.log(`Variants not matched: ${missingVariants}`);

    if (!WRITE_MODE) {
      console.log(
        '\nDry run only: no MongoDB records were changed.\n' +
          'Review the output, then run the same command with --write.'
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('\nRecovery failed:', error.message);
  process.exit(1);
});