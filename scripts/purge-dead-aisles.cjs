const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { MongoClient, ObjectId, BSON } = require('mongodb');
const { EJSON } = BSON;

require('dotenv').config({
  path: path.resolve(__dirname, '../.env.local'),
  quiet: true,
});

const execute = process.argv.includes('--execute');
const approval = process.argv
  .find(a => a.startsWith('--approve='))?.slice('--approve='.length);

const str = v => (v === null || v === undefined ? null : String(v));

async function main() {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is missing.');
  if (execute && !approval) throw new Error('Run the preview first.');

  const { publicProductEligibility, publicIpEligibility } = await import(
    pathToFileURL(path.resolve(__dirname, '../lib/public-inventory-eligibility.js'))
  );

  const client = new MongoClient(process.env.MONGO_URL);
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || 'metawork_db');

    const allUsers = await db.collection('users').find({}).toArray();
    const knownIds = new Set(
      allUsers.flatMap(u => [u._id, u.id, u.userId].map(str).filter(Boolean))
    );

    const aisleUsers = allUsers.filter(u => u.aisleSettings !== undefined);
    const aisleDocs = await db.collection('aisles').find({}).toArray();
    const plan = [];

    for (const user of aisleUsers) {
      const strIds = [...new Set(
        [user._id, user.id, user.userId, user.username].map(str).filter(Boolean)
      )];
      const objIds = strIds.filter(ObjectId.isValid).map(v => new ObjectId(v));
      const ids = [...strIds, ...objIds];

      const productOwner = { $or: [
        { creatorId: { $in: ids } }, { userId: { $in: ids } },
        { ownerId: { $in: ids } },
        ...(user.username ? [
          { creatorUsername: user.username }, { ownerUsername: user.username },
        ] : []),
      ] };
      const ipOwner = { $or: [
        { ownerId: { $in: ids } }, { userId: { $in: ids } },
        { creatorId: { $in: ids } },
        ...(user.username ? [
          { ownerUsername: user.username }, { creatorUsername: user.username },
          { username: user.username },
        ] : []),
      ] };

      const [product, ip] = await Promise.all([
        db.collection('products').findOne(
          { $and: [productOwner, publicProductEligibility()] },
          { projection: { _id: 1 } }
        ),
        db.collection('ip_assets').findOne(
          { $and: [ipOwner, publicIpEligibility()] },
          { projection: { _id: 1 } }
        ),
      ]);
      if (product || ip) continue;

      const owned = aisleDocs.filter(a => strIds.includes(str(a.userId)));
      plan.push({
        kind: 'dead-user-aisle',
        userId: str(user._id),
        username: user.username || null,
        title: user.aisleSettings?.title || null,
        aisleDocIds: owned.map(a => str(a._id)),
      });
    }

    for (const a of aisleDocs) {
      if (!knownIds.has(str(a.userId))) {
        plan.push({
          kind: 'orphan-aisle-doc',
          userId: null,
          username: null,
          title: a.title || null,
          aisleDocIds: [str(a._id)],
        });
      }
    }

    for (let i = plan.length - 1; i >= 0; i--) {
      if (plan[i].userId && plan[i].userId.startsWith('user_')) plan.splice(i, 1);
    }

    plan.sort((x, y) =>
      (x.userId || x.aisleDocIds[0]).localeCompare(y.userId || y.aisleDocIds[0]));

    const token = createHash('sha256').update(EJSON.stringify(plan)).digest('hex');

    console.log(`Database: ${db.databaseName}`);
    console.log(`Mode: ${execute ? 'EXECUTE' : 'READ-ONLY PREVIEW'}`);
    console.log(`Aisle users scanned: ${aisleUsers.length}`);
    console.log(`Aisle documents scanned: ${aisleDocs.length}\n`);
    console.table(plan.map(p => ({
      kind: p.kind,
      username: p.username,
      title: p.title,
      userId: p.userId,
      aisleDocs: p.aisleDocIds.length,
    })));
    console.log(`Dead aisles selected: ${plan.length}`);

    if (!execute) {
      console.log('\nNo data changed. To apply this exact selection:');
      console.log(`node scripts/purge-dead-aisles.cjs --execute --approve=${token}`);
      return;
    }
    if (approval !== token) {
      throw new Error('Selection changed or token wrong. Run preview again.');
    }

    const userIds = plan.filter(p => p.userId).map(p => new ObjectId(p.userId));
    const aisleIds = plan.flatMap(p => p.aisleDocIds).map(id => new ObjectId(id));

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const del = await db.collection('aisles')
          .deleteMany({ _id: { $in: aisleIds } }, { session });
        const upd = await db.collection('users').updateMany(
          { _id: { $in: userIds } },
          { $unset: { aisleSettings: '' } },
          { session }
        );
        if (del.deletedCount !== aisleIds.length ||
            upd.modifiedCount !== userIds.length) {
          throw new Error('Count mismatch; transaction aborted.');
        }
      });
    } finally {
      await session.endSession();
    }

    console.log(`Deleted ${aisleIds.length} aisle documents.`);
    console.log(`Removed aisleSettings from ${userIds.length} users.`);
  } finally {
    await client.close();
  }
}

main().catch(e => { console.error(`STOPPED: ${e.message}`); process.exitCode = 1; });
