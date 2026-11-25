const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient, ObjectId, BSON } = require('mongodb');
const { EJSON } = BSON;

require('dotenv').config({
  path: path.resolve(__dirname, '../.env.local'),
  quiet: true,
});

const TARGET = 'LYMBER';
const TARGET_ID = '6976ba9474b6ffa77d502a32';
const DB_NAME = process.env.DB_NAME || 'metawork_db';
const URI = process.env.MONGO_URL;
const execute = process.argv.includes('--execute');
const approval = process.argv
  .find(arg => arg.startsWith('--approve='))
  ?.slice('--approve='.length);

const identityFields = new Set([
  'userId', 'ownerId', 'creatorId', 'accountId', 'customerId',
  'sellerId', 'buyerId', 'authorId', 'uploaderId',
  'user', 'owner', 'creator',
  'username', 'ownerUsername', 'creatorUsername', 'sellerUsername',
  'buyerUsername', 'authorUsername',
  'email', 'userEmail', 'ownerEmail', 'creatorEmail', 'customerEmail',
  'walletAddress', 'ownerWallet', 'creatorWallet', 'userWallet',
]);

const referenceFields = new Set([
  'productId', 'productIds', 'ipAssetId', 'ipAssetIds',
  'ipId', 'ipIds', 'sourceIpId', 'sourceIPId',
  'collectionId', 'collectionIds', 'parentProductId',
  'originalProductId',
]);

function scalar(value) {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function key(value) {
  const s = scalar(value);
  return s === null ? null : s.toLowerCase();
}

function walk(value, visit, field = '', location = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walk(item, visit, field, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === 'object' &&
      !(value instanceof ObjectId) && !(value instanceof Date) &&
      !Buffer.isBuffer(value)) {
    for (const [name, item] of Object.entries(value)) {
      walk(item, visit, name, location ? `${location}.${name}` : name);
    }
    return;
  }
  visit(field, value, location);
}

function documentKey(collection, id) {
  return `${collection}:${EJSON.stringify(id)}`;
}

async function main() {
  if (!URI) throw new Error('MONGO_URL is missing.');
  if (execute && !approval) {
    throw new Error('Run the preview first, then supply its --approve token.');
  }

  const client = new MongoClient(URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const users = await db.collection('users').find({
      $or: [
        { _id: new ObjectId(TARGET_ID) },
        { _id: TARGET_ID },
        { username: /^LYMBER$/i },
      ],
    }).toArray();

    if (users.length !== 1 ||
        scalar(users[0]._id) !== TARGET_ID ||
        String(users[0].username).trim().toUpperCase() !== TARGET) {
      throw new Error(
        'Identity mismatch or duplicate account. No deletion performed.'
      );
    }

    const user = users[0];
    const identities = new Set();

    function addIdentity(value) {
      const normalized = key(value);
      if (normalized) identities.add(normalized);
    }

    [
      user._id, user.id, user.userId, user.username, user.email,
      user.walletAddress, user.defaultWallet,
      user.profile?.walletAddress, user.wallet?.address,
      ...(Array.isArray(user.wallets)
        ? user.wallets.map(w => typeof w === 'string' ? w : w?.address)
        : []),
    ].forEach(addIdentity);

    console.log(`Database: ${DB_NAME}`);
    console.log(`Target: ${user.username} / ${scalar(user._id)}`);
    console.log(`Mode: ${execute ? 'EXECUTE' : 'READ-ONLY PREVIEW'}`);
    console.log('Scanning collections; this may take several minutes.');

    const collections = (await db.listCollections(
      {}, { nameOnly: true }
    ).toArray())
      .map(c => c.name)
      .filter(name => !name.startsWith('system.'))
      .sort();

    const selected = new Map();
    const linkedIds = new Set();
    const protectedReferences = new Set();

    function select(collection, doc, reason) {
      const id = documentKey(collection, doc._id);
      if (selected.has(id)) return false;

      selected.set(id, {
        collection,
        id: doc._id,
        reason,
        digest: createHash('sha256')
          .update(EJSON.stringify(doc))
          .digest('hex'),
      });

      if (['products', 'ip_assets', 'collections'].includes(collection)) {
        [doc._id, doc.id].forEach(value => {
          const normalized = key(value);
          if (normalized) linkedIds.add(normalized);
        });
      }
      return true;
    }

    select('users', user, 'verified target account');

    let changed;
    do {
      changed = false;

      for (const collection of collections) {
        const cursor = db.collection(collection).find({});
        for await (const doc of cursor) {
          if (selected.has(documentKey(collection, doc._id))) continue;

          let reason = null;
          walk(doc, (field, value, location) => {
            const normalized = key(value);
            if (!normalized) return;

            if (identityFields.has(field) && identities.has(normalized)) {
              reason ||= `account match: ${location}`;
            }
            if (referenceFields.has(field) && linkedIds.has(normalized)) {
              reason ||= `inventory reference: ${location}`;
            }
          });

          if (!reason) continue;

          if (collection === 'users') {
            protectedReferences.add(scalar(doc._id));
            continue;
          }

          if (select(collection, doc, reason)) changed = true;
        }
      }
    } while (changed);

    const plan = [...selected.values()].sort((a, b) =>
      documentKey(a.collection, a.id)
        .localeCompare(documentKey(b.collection, b.id))
    );

    const token = createHash('sha256')
      .update(EJSON.stringify({ database: DB_NAME, plan }))
      .digest('hex');

    const counts = {};
    for (const item of plan) {
      counts[item.collection] = (counts[item.collection] || 0) + 1;
      console.log(
        `${item.collection} | ${scalar(item.id)} | ${item.reason}`
      );
    }
    console.table(counts);

    if (protectedReferences.size) {
      throw new Error(
        'Other users contain LYMBER references: ' +
        [...protectedReferences].join(', ') +
        '. Stopped without writes; these need field-level cleanup.'
      );
    }

    console.log(
      '\nWhole matching documents are selected, including any matching ' +
      'orders or other shared records. Review the list before executing.'
    );

    if (!execute) {
      console.log('\nNo data changed. To delete this exact selection:');
      console.log(
        `node scripts/purge-lymber.cjs --execute --approve=${token}`
      );
      return;
    }

    if (approval !== token) {
      throw new Error(
        'Selection changed or approval token is wrong. Run preview again.'
      );
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const ordered = [
          ...plan.filter(item => item.collection !== 'users'),
          ...plan.filter(item => item.collection === 'users'),
        ];

        for (const item of ordered) {
          const collection = db.collection(item.collection);
          const current = await collection.findOne(
            { _id: item.id }, { session }
          );
          const digest = current && createHash('sha256')
            .update(EJSON.stringify(current))
            .digest('hex');

          if (digest !== item.digest) {
            throw new Error(
              `Document changed: ${item.collection}/${scalar(item.id)}`
            );
          }

          const result = await collection.deleteOne(
            { _id: item.id }, { session }
          );
          if (result.deletedCount !== 1) {
            throw new Error('Delete count mismatch; transaction aborted.');
          }
        }
      }, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });
    } finally {
      await session.endSession();
    }

    let remaining = 0;
    for (const item of plan) {
      remaining += await db.collection(item.collection)
        .countDocuments({ _id: item.id });
    }

    if (remaining) {
      throw new Error(
        `Deletion committed, but ${remaining} selected records still exist.`
      );
    }

    console.log(
      `Deleted and verified ${plan.length} MongoDB documents for LYMBER.`
    );
    console.log(
      'External media, external services, repository exports, backups, ' +
      'and blockchain records were not modified.'
    );
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error(`PURGE STOPPED: ${error.message}`);
  process.exitCode = 1;
});
