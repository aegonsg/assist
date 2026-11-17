import { MongoClient } from "mongodb";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Set MONGODB_URI before creating database indexes.");
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME ?? "personal_assistant");
  await Promise.all([
    db.collection("contacts").createIndex({ username: 1 }, { unique: true }),
    db.collection("messages").createIndex({ contactId: 1, createdAt: 1 }),
    db.collection("messages").createIndex({ createdAt: 1 }, { expireAfterSeconds: 72 * 60 * 60 }),
    db.collection("groupMessages").createIndex({ groupId: 1, createdAt: 1 }),
    db.collection("groupMessages").createIndex({ createdAt: 1 }, { expireAfterSeconds: 72 * 60 * 60 }),
    db.collection("savedMessages").createIndex({ ownerId: 1, sourceType: 1, sourceMessageId: 1 }, { unique: true }),
    db.collection("savedMessages").createIndex({ ownerId: 1, savedAt: -1 }),
    db.collection("requests").createIndex({ status: 1, createdAt: -1 }),
    db.collection("requests").createIndex({ contactId: 1, createdAt: -1 }),
    db.collection("requests").createIndex({ createdAt: 1 }, { expireAfterSeconds: 72 * 60 * 60 }),
    db.collection("pushSubscriptions").createIndex({ "subscription.endpoint": 1 }, { unique: true }),
    db.collection("loginAttempts").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  console.log("MongoDB indexes created.");
} finally {
  await client.close();
}
