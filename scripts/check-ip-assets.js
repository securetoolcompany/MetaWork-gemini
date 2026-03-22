// scripts/check-ip-assets.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;       // already set in your repl
const dbName = "metawork_db";             // or your actual DB name

const ids = [
  "ip_1767293382706_uu6p1",
  "ip_1767303757942_6edzv",
];

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection("ip_assets");

    const docs = await col.find({ id: { $in: ids } }).toArray();
    console.log(JSON.stringify(docs, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

main();
