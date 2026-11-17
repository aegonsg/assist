import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  newPassword: z.string().min(10).max(128),
  confirmPassword: z.string().min(10).max(128),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "New password confirmation does not match.",
  path: ["confirmPassword"],
});

export async function GET() {
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const profile = await db.collection<Document & { _id: string }>("ownerProfiles").findOne(
    { _id: "primary-owner" },
    { projection: { username: 1 } }
  );
  return NextResponse.json({ username: profile?.username ?? process.env.OWNER_USERNAME ?? "" });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the new owner credentials." }, { status: 400 });
  }

  const db = await getDb();
  const profiles = db.collection<Document & { _id: string }>("ownerProfiles");
  const profile = await profiles.findOne({ _id: "primary-owner" });
  const currentHash = profile?.passwordHash || process.env.OWNER_PASSWORD_HASH;
  if (!currentHash || !(await bcrypt.compare(parsed.data.currentPassword, currentHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const now = new Date();
  const saved = await profiles.updateOne(
    profile ? { _id: "primary-owner", passwordHash: profile.passwordHash } : { _id: "primary-owner", passwordHash: { $exists: false } },
    {
      $set: {
        name: profile?.name ?? process.env.OWNER_NAME ?? "ADHAVAN",
        username: parsed.data.username,
        passwordHash: newPasswordHash,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: !profile }
  );
  if (!saved.matchedCount && !saved.upsertedCount) {
    return NextResponse.json({ error: "Owner credentials changed during this request. Reload and try again." }, { status: 409 });
  }

  await db.collection("auditLogs").insertOne({
    actor: "owner",
    action: "owner_credentials_changed",
    details: "Owner username and password updated",
    createdAt: now,
  });
  return NextResponse.json({ ok: true, username: parsed.data.username });
}
