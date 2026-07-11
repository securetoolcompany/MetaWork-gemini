// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'metawork_db';

if (!uri) {
  throw new Error('MONGO_URL env var is not set');
}

// Survive hot-module reloads in dev by pinning to globalThis
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri);
    globalThis._mongoClientPromise = client.connect().then(() => client);
  }
  clientPromise = globalThis._mongoClientPromise;
} else {
  // In production, module cache is stable — no global needed
  const client = new MongoClient(uri);
  clientPromise = client.connect().then(() => client);
}

export async function connectToDatabase() {
  const client = await clientPromise;
  const db = client.db(dbName);
  return { client, db };
}

export async function getDatabase() {
  const { db } = await connectToDatabase();
  return db;
}

export async function ensureUserIndexes() {
  const { db } = await connectToDatabase();
  const users = db.collection('users');

  try {
    try {
      await users.dropIndex('walletAddress_1');
      await users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });
    } catch (e) { /* Index might not exist yet */ }

    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
    await users.createIndex({ 'wallets.address': 1 }, { unique: true, sparse: true });
    await users.createIndex({ username: 1 }, { unique: true });

    console.log('✅ User collection indexes corrected with sparse flags');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}

export function normalizeId(doc) {
  if (!doc) return doc;
  if (!doc.id && doc._id) doc.id = doc._id.toString();
  if (doc._id) doc._id = doc._id.toString();
  return doc;
}

export function normalizeIds(docs) {
  return docs.map(normalizeId);
}