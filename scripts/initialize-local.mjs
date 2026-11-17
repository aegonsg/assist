import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import nextEnv from "@next/env";
import { MongoClient } from "mongodb";
import { generateVAPIDKeys } from "web-push";

const envPath = join(process.cwd(), ".env.local");
let envFile;
try {
  envFile = await readFile(envPath, "utf8");
} catch {
  throw new Error("Missing .env.local. Copy .env.example and set MONGODB_URI locally before running setup.");
}

function currentValue(key) {
  const line = envFile.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  return line?.slice(key.length + 1).replace(/^["']|["']$/g, "").trim() ?? "";
}

const mongoUri = currentValue("MONGODB_URI");
if (!mongoUri) {
  throw new Error("MONGODB_URI is empty. Add a rotated MongoDB Atlas URI to .env.local, then run setup again.");
}

const generatedOwnerPassword = currentValue("OWNER_PASSWORD_HASH")
  ? null
  : `Av${randomBytes(18).toString("base64url")}9!`;
const generatedOwnerHash = generatedOwnerPassword
  ? await bcrypt.hash(generatedOwnerPassword, 12)
  : null;
const generatedTestPassword = `Tv${randomBytes(18).toString("base64url")}4!`;
const configuredJwtSecret = currentValue("JWT_SECRET");
const generatedJwtSecret = configuredJwtSecret.length >= 32
  ? configuredJwtSecret
  : randomBytes(48).toString("base64url");
const generatedVapid = currentValue("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && currentValue("VAPID_PRIVATE_KEY")
  ? null
  : generateVAPIDKeys();

const config = new Map([
  ["JWT_SECRET", generatedJwtSecret],
  ["OWNER_NAME", currentValue("OWNER_NAME") || "ADHAVAN"],
  ["OWNER_USERNAME", currentValue("OWNER_USERNAME") || "adhavan"],
  ["MONGODB_DB_NAME", currentValue("MONGODB_DB_NAME") || "personal_assistant"],
  ["NEXT_PUBLIC_APP_URL", currentValue("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"],
  ["AI_MODEL", currentValue("AI_MODEL") || "llama-3.3-70b-versatile"],
]);
if (generatedOwnerHash) config.set("OWNER_PASSWORD_HASH", generatedOwnerHash);
if (generatedVapid) {
  config.set("NEXT_PUBLIC_VAPID_PUBLIC_KEY", generatedVapid.publicKey);
  config.set("VAPID_PRIVATE_KEY", generatedVapid.privateKey);
}

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const ownerName = config.get("OWNER_NAME");
  const ownerUsername = config.get("OWNER_USERNAME");
  const db = client.db(config.get("MONGODB_DB_NAME"));
  await db.collection("ownerProfiles").updateOne(
    { _id: "primary-owner" },
    {
      $set: { name: ownerName, updatedAt: new Date() },
      $setOnInsert: { username: ownerUsername, createdAt: new Date() },
    },
    { upsert: true }
  );
  await db.collection("contacts").createIndex({ username: 1 }, { unique: true });
  await Promise.all([
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

  const contacts = db.collection("contacts");
  const testUsername = "test_user";
  await contacts.deleteOne({ username: testUsername });
  await contacts.insertOne({
    _id: randomUUID(),
    name: "Test User",
    username: testUsername,
    passwordHash: await bcrypt.hash(generatedTestPassword, 12),
    disabled: false,
    tokenVersion: 0,
    createdAt: new Date(),
  });

  const lines = envFile.split(/\r?\n/).filter(Boolean);
  for (const [key, value] of config) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    const entry = `${key}=${value.replaceAll("$", "\\$")}`;
    if (index >= 0) lines[index] = entry;
    else lines.push(entry);
  }
  await writeFile(envPath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  nextEnv.loadEnvConfig(process.cwd());

  console.log("Local database initialized. Copy the following one-time credentials into your password manager:");
  console.log(`Owner name: ${ownerName}`);
  console.log(`Owner username: ${ownerUsername}`);
  if (generatedOwnerPassword) console.log(`Owner password: ${generatedOwnerPassword}`);
  console.log(`Test user name: Test User`);
  console.log(`Test user username: ${testUsername}`);
  console.log(`Test user password: ${generatedTestPassword}`);
  console.log("The owner password is only printed when a new owner password hash was generated.");
} finally {
  await client.close();
}
