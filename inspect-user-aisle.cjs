const dns = require('node:dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const TARGET_EMAIL = 'vyzion82@gmail.com'.toLowerCase();

function getMongoUri() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL;

  if (!uri) {
    throw new Error(
      'Missing Mongo connection string. Set MONGODB_URI, MONGO_URI, or DATABASE_URL in .env.local.',
    );
  }

  return uri;
}

function redactUser(user) {
  if (!user) return null;

  const {
    password,
    passwordHash,
    resetToken,
    resetPasswordToken,
    verificationToken,
    emailVerificationToken,
    ...safeUser
  } = user;

  return safeUser;
}

async function main() {
  const client = new MongoClient(getMongoUri());

  try {
    await client.connect();

    const dbName =
      process.env.MONGODB_DB ||
      process.env.MONGO_DB_NAME ||
      undefined;

    const db = dbName ? client.db(dbName) : client.db();
    const users = db.collection('users');

    const matches = await users
      .find({
        email: {
          $regex: `^${TARGET_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          $options: 'i',
        },
      })
      .toArray();

    console.log(
      JSON.stringify(
        {
          database: db.databaseName,
          collection: 'users',
          targetEmail: TARGET_EMAIL,
          matchCount: matches.length,
          records: matches.map((user) => ({
            id: String(user._id),
            bsonIdType: user._id?.constructor?.name ?? typeof user._id,
            email: user.email,
            username: user.username,
            authMethod: user.authMethod,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            aisleSettingsUpdatedAt: user.aisleSettingsUpdatedAt,
            hasAisleSettings: Boolean(user.aisleSettings),
            aisleSettings: user.aisleSettings ?? null,
            profile: user.profile ?? null,
            safeFullRecord: redactUser(user),
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Inspection failed:', error);
  process.exitCode = 1;
});