import { createHash } from "node:crypto";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;

function getKeys(request: Request, username: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",").at(-1)?.trim() || "unknown";
  const identifiers = [`ip:${ip}`, `account:${username.trim().toLowerCase()}`];
  return identifiers.map((identifier) => createHash("sha256").update(identifier).digest("hex"));
}

export async function isLoginRateLimited(request: Request, username: string) {
  const keys = getKeys(request, username);
  const db = await getDb();
  const attempts = db.collection<Document & { _id: string; count: number; expiresAt: Date }>("loginAttempts");
  const records = await attempts.find({ _id: { $in: keys }, expiresAt: { $gt: new Date() } }).toArray();
  return records.some((item) => item.count >= 8);
}

export async function recordLoginFailure(request: Request, username: string) {
  const keys = getKeys(request, username);
  const now = new Date();
  const resetAt = new Date(now.getTime() + WINDOW_MS);
  const db = await getDb();
  const attempts = db.collection<Document & { _id: string; count: number; expiresAt: Date }>("loginAttempts");

  await Promise.all(keys.map(async (key) => {
    await attempts.updateOne(
      { _id: key },
      [{
        $set: {
          count: {
            $cond: [
              { $lte: [{ $ifNull: ["$expiresAt", now] }, now] },
              1,
              { $add: [{ $ifNull: ["$count", 0] }, 1] },
            ],
          },
          expiresAt: {
            $cond: [
              { $lte: [{ $ifNull: ["$expiresAt", now] }, now] },
              resetAt,
              "$expiresAt",
            ],
          },
        },
      }],
      { upsert: true }
    );
  }));
}

export async function clearLoginAttempts(request: Request, username: string) {
  const keys = getKeys(request, username);
  const db = await getDb();
  await db.collection<Document & { _id: string }>("loginAttempts").deleteMany({ _id: { $in: keys } });
}
