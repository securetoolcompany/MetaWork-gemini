// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
//const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = process.env.DB_NAME || 'metawork_db';
const options = {};

if (!uri) {
  throw new Error('MONGO_URL env var is not set');
}

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, options);
  await client.connect();
  
  // EXPLICITLY TARGET metawork_db
  const db = client.db(dbName);
  console.log(`✅ Connected to database: ${dbName}`);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getDatabase() {
  const { db } = await connectToDatabase();
  return db;
}

/**
 * Ensures user collection indexes for uniqueness and performance.
 * Updated to support multi-chain wallet arrays and prioritized merging.
 */
export async function ensureUserIndexes() {
  const { db } = await connectToDatabase();
  const users = db.collection('users');

  try {
    // Drop existing problematic indexes first to re-create them with sparse
    try {
      await users.dropIndex("walletAddress_1");
      await users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });
    } catch (e) { /* Index might not exist yet */ }

    // Ensure all other unique but optional fields are sparse
    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
    
    // Multi-chain array index should also be sparse
    await users.createIndex({ "wallets.address": 1 }, { unique: true, sparse: true });

    await users.createIndex({ username: 1 }, { unique: true });
    
    console.log('✅ User collection indexes corrected with sparse flags');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}

// Helper: Normalize MongoDB _id to id for frontend compatibility
export function normalizeId(doc) {
  if (!doc) return doc;
  if (!doc.id && doc._id) {
    doc.id = doc._id.toString();
  }
  // Remove MongoDB _id if we have id to avoid confusion
  if (doc._id) {
    doc._id = doc._id.toString();
  }
  return doc;
}

// Helper: Normalize array of documents
export function normalizeIds(docs) {
  return docs.map(normalizeId);
}
