import { MongoClient } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add your MongoDB Atlas connection string to the environment.");
  }
  const clientPromise =
    globalForMongo.mongoClientPromise ??
    new MongoClient(uri, { maxPoolSize: 10 }).connect();
  globalForMongo.mongoClientPromise = clientPromise;
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB_NAME ?? "personal_assistant");
}
