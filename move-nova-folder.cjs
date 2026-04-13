require('dotenv').config({ path: '.env.local' });

const fs = require('fs/promises');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  process.env.MONGO_URI;

const MONGODB_DB =
  process.env.MONGODB_DB ||
  process.env.DB_NAME ||
  'metawork_db';

const PRODUCTS_COLLECTION = 'products';

const PRINTFUL_TOKEN =
  process.env.PRINTFUL_API_TOKEN ||
  process.env.PRINTFUL_API_KEY;

const PRINTFUL_OLD_STORE_ID = process.env.PRINTFUL_OLD_STORE_ID;
const PRINTFUL_NEW_STORE_ID =
  process.env.PRINTFUL_NEW_STORE_ID ||
  process.env.PRINTFUL_STORE_ID;

const PRINTFUL_BASE_URL = 'https://api.printful.com';
const AUDIT_FILE = 'mongodb-products-audit.json';

const DRY_RUN = true;
const MIGRATION_LIMIT = 5;
const BASE_DELAY_MS = 1000;
const RETRY_429_MS = 65000;

if (!MONGODB_URI) throw new Error('Missing Mongo connection string');
if (!PRINTFUL_TOKEN) throw new Error('Missing PRINTFUL_API_KEY / PRINTFUL_API_TOKEN');
if (!PRINTFUL_OLD_STORE_ID) throw new Error('Missing PRINTFUL_OLD_STORE_ID');
if (!PRINTFUL_NEW_STORE_ID) throw new Error('Missing PRINTFUL_STORE_ID / PRINTFUL_NEW_STORE_ID');

function headersForStore(storeId) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${PRINTFUL_TOKEN}`,
    'X-PF-Store-Id': String(storeId),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { raw: text };
  }

  if (!res.ok) {
    const error = new Error(`Printful error ${res.status}: ${JSON.stringify(data)}`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function getOldSyncProductByExternalId(externalId) {
  const url = new URL(`${PRINTFUL_BASE_URL}/store/products`);
  url.searchParams.set('external_id', externalId);

  const data = await fetchJson(url.toString(), {
    method: 'GET',
    headers: headersForStore(PRINTFUL_OLD_STORE_ID),
  });

  const result = data.result;

  if (!result) return null;
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result.products)) return result.products[0] || null;
  if (Array.isArray(result.result)) return result.result[0] || null;

  return result;
}

function normalizeOldVariants(oldSyncProduct) {
  if (Array.isArray(oldSyncProduct.sync_variants)) return oldSyncProduct.sync_variants;
  if (Array.isArray(oldSyncProduct.variants)) return oldSyncProduct.variants;
  return [];
}

function buildMongoVariantMap(product) {
  const map = new Map();

  for (const v of product.variations || []) {
    const variantId = Number(v.printfulVariantId || v.id);
    if (!variantId) continue;
    map.set(variantId, v);
  }

  return map;
}

function buildCreatePayload(oldSyncProduct, mongoProduct) {
  const oldVariants = normalizeOldVariants(oldSyncProduct);
  if (!oldVariants.length) {
    throw new Error('Old sync product has no variants');
  }

  const mongoVariantMap = buildMongoVariantMap(mongoProduct);

  const sync_product = {
    name: mongoProduct.name || oldSyncProduct.name || 'Untitled product',
    external_id: mongoProduct.id || String(mongoProduct._id),
    thumbnail: mongoProduct.image || oldSyncProduct.thumbnail || undefined,
  };

  const sync_variants = oldVariants.map((oldVariant) => {
    const variantId = Number(oldVariant.variant_id);
    const mongoVariant = mongoVariantMap.get(variantId);

    const retailPrice =
      mongoVariant?.regular_price ??
      mongoVariant?.price ??
      mongoProduct.price ??
      oldVariant.retail_price ??
      null;

    return {
      variant_id: variantId,
      external_id: `${mongoProduct.id || mongoProduct._id}-${variantId}`,
      retail_price: retailPrice != null ? String(retailPrice) : undefined,
      sku: mongoVariant?.sku || oldVariant.sku || undefined,
      files: oldVariant.files || [],
      options: oldVariant.options || [],
    };
  });

  const missingFiles = sync_variants.filter(
    (v) => !Array.isArray(v.files) || v.files.length === 0
  );

  if (missingFiles.length) {
    throw new Error(`Missing variant files on cloned source product (${missingFiles.length} variants)`);
  }

  return { sync_product, sync_variants };
}

async function createNewSyncProduct(payload) {
  if (DRY_RUN) {
    return {
      id: 'dry-run-store-product-id',
      variants: payload.sync_variants.map((v, i) => ({
        id: `dry-run-sync-variant-${i + 1}`,
        external_id: v.external_id,
        variant_id: v.variant_id,
      })),
    };
  }

  const data = await fetchJson(`${PRINTFUL_BASE_URL}/store/products`, {
    method: 'POST',
    headers: headersForStore(PRINTFUL_NEW_STORE_ID),
    body: JSON.stringify(payload),
  });

  const result = data.result || data;

  return {
    id: result.id,
    variants: (result.variants || result.sync_variants || []).map((sv) => ({
      id: sv.id,
      external_id: sv.external_id,
      variant_id: sv.variant_id,
    })),
  };
}

async function createWithRetry(payload) {
  try {
    return await createNewSyncProduct(payload);
  } catch (err) {
    if (err.status === 429) {
      console.log(`Rate limited. Waiting ${RETRY_429_MS / 1000}s and retrying once...`);
      await sleep(RETRY_429_MS);
      return await createNewSyncProduct(payload);
    }
    throw err;
  }
}

async function main() {
  console.log('Starting Printful clone migration script');

  const auditPath = path.resolve(AUDIT_FILE);
  const auditRaw = await fs.readFile(auditPath, 'utf8');
  const audit = JSON.parse(auditRaw);

  const readyProducts = audit.ready || [];
  console.log(`Loaded audit file with ${audit.stats?.totalProducts || 0} total, ${readyProducts.length} readyForMigration`);

  const toProcess = MIGRATION_LIMIT > 0
    ? readyProducts.slice(0, MIGRATION_LIMIT)
    : readyProducts;

  console.log(`Processing ${toProcess.length} product(s)`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db(MONGODB_DB);
  const productsCol = db.collection(PRODUCTS_COLLECTION);

  let migratedCount = 0;
  const failures = [];

  for (const ready of toProcess) {
    const mongoIdStr = ready._id;

    console.log('\n---');
    console.log(`Migrating product ${mongoIdStr} - ${ready.name}`);

    try {
      const product = await productsCol.findOne({ _id: new ObjectId(mongoIdStr) });

      if (!product) {
        throw new Error('Product not found in Mongo');
      }

      if (product?.printful?.storeProductId) {
        console.log('Already migrated, skipping');
        continue;
      }

      const externalProductId =
        product?.legacyMetadata?._smpf_external_product_id ||
        ready.externalProductId ||
        null;

      if (!externalProductId) {
        throw new Error('Missing externalProductId');
      }

      await sleep(BASE_DELAY_MS);

      const oldSyncProduct = await getOldSyncProductByExternalId(externalProductId);

      if (!oldSyncProduct) {
        throw new Error(`Old sync product not found for external_id=${externalProductId}`);
      }

      const payload = buildCreatePayload(oldSyncProduct, product);

      await sleep(BASE_DELAY_MS);

      const created = await createWithRetry(payload);

      console.log(`Created new store sync product ${created.id} with ${created.variants.length} variants`);

      if (!DRY_RUN) {
        const syncVariants = created.variants.map((sv) => ({
          syncVariantId: sv.id,
          externalId: sv.external_id,
          printfulVariantId: sv.variant_id,
        }));

        await productsCol.updateOne(
          { _id: product._id },
          {
            $set: {
              'printful.storeProductId': created.id,
              'printful.syncVariants': syncVariants,
              'printful.migratedAt': new Date(),
              'printful.migrationSource': 'old-store-to-new-store-clone',
              'printful.oldExternalProductId': externalProductId,
              'printful.oldStoreId': String(PRINTFUL_OLD_STORE_ID),
              'printful.newStoreId': String(PRINTFUL_NEW_STORE_ID),
            },
          }
        );

        console.log('Updated Mongo with new Printful sync IDs');
      }

      migratedCount += 1;
    } catch (err) {
      console.error(`Migration failed: ${err.message}`);
      failures.push({
        mongoId: mongoIdStr,
        name: ready.name,
        error: err.message,
      });
    }
  }

  const report = {
    migratedCount,
    failureCount: failures.length,
    failures,
    dryRun: DRY_RUN,
    processedCount: toProcess.length,
    oldStoreId: String(PRINTFUL_OLD_STORE_ID),
    newStoreId: String(PRINTFUL_NEW_STORE_ID),
    completedAt: new Date().toISOString(),
  };

  const reportPath = path.resolve('printful-clone-migration-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n===');
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Report written to ${reportPath}`);

  await client.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});