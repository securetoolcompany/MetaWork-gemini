const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'metawork_db';
const COLLECTION = process.env.PRODUCTS_COLLECTION || 'products';
const DRY_RUN = process.env.DRY_RUN !== 'true';

if (!MONGO_URL) {
  console.error('Missing MONGO_URL or MONGODB_URI env var');
  process.exit(1);
}

const REQUIRED_FIELDS = [
  'printfulVariantId',
  'sync_variant_id',
  'printful_variant_id',
  'variant_id',
];

function get(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function firstPresent(doc, keys) {
  for (const key of keys) {
    const value = get(doc, key);
    if (value !== undefined && value !== null && value !== '') return { key, value };
  }
  return null;
}

function collectVariantCandidates(doc) {
  const out = [];
  const top = firstPresent(doc, REQUIRED_FIELDS);
  if (top) out.push(top);

  if (Array.isArray(doc.variants)) {
    for (const v of doc.variants) {
      const found = firstPresent(v, REQUIRED_FIELDS);
      if (found) out.push(found);
    }
  }

  if (Array.isArray(doc.printfulVariants)) {
    for (const v of doc.printfulVariants) {
      const found = firstPresent(v, REQUIRED_FIELDS);
      if (found) out.push(found);
    }
  }

  return out;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildUpdate(doc) {
  const candidates = collectVariantCandidates(doc);
  const normalized = candidates
    .map(c => ({ ...c, normalized: normalizeNumber(c.value) }))
    .filter(c => c.normalized !== null);

  const update = { $set: {}, $unset: {} };
  const issues = [];

  const chosen = normalized[0];
  if (chosen) {
    if (doc.sync_variant_id !== chosen.normalized) update.$set.sync_variant_id = chosen.normalized;
    if (doc.printfulVariantId !== chosen.normalized) update.$set.printfulVariantId = chosen.normalized;
  } else {
    issues.push('missing_variant_id');
  }

  const syncProductId = firstPresent(doc, ['sync_product_id', 'printfulProductId', 'product_id']);
  if (syncProductId) {
    const n = normalizeNumber(syncProductId.value);
    if (n !== null && doc.sync_product_id !== n) update.$set.sync_product_id = n;
  }

  const externalId = firstPresent(doc, ['external_id', 'printfulExternalId', 'slug', 'handle']);
  if (externalId && !doc.external_id) {
    update.$set.external_id = String(externalId.value);
  }

  if (Object.keys(update.$set).length === 0) delete update.$set;
  if (Object.keys(update.$unset).length === 0) delete update.$unset;

  return { update, issues, chosen };
}

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  const docs = await collection.find({}).toArray();
  const report = {
    db: DB_NAME,
    collection: COLLECTION,
    dryRun: DRY_RUN,
    total: docs.length,
    missingVariantId: 0,
    updated: 0,
    unchanged: 0,
    flagged: [],
  };

  for (const doc of docs) {
    const { update, issues, chosen } = buildUpdate(doc);
    const hasUpdate = !!(update.$set || update.$unset);

    if (issues.includes('missing_variant_id')) {
      report.missingVariantId += 1;
      report.flagged.push({
        _id: String(doc._id),
        title: doc.title || doc.name || '(untitled)',
        slug: doc.slug || null,
        issue: 'missing_variant_id',
      });
    }

    if (hasUpdate) {
      if (!DRY_RUN) {
        await collection.updateOne({ _id: doc._id instanceof ObjectId ? doc._id : new ObjectId(doc._id) }, update);
      }
      report.updated += 1;
    } else {
      report.unchanged += 1;
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await client.close();
})();