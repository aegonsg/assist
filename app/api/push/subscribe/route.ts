import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const schema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const ownerSession = await getSession("owner_session", "owner");
  const userSession = ownerSession ? null : await getSession("user_session", "user");
  if (!ownerSession && !userSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });

  const db = await getDb();
  let subscriber: { role: "owner" | "user"; contactId?: string };
  if (ownerSession) {
    subscriber = { role: "owner" };
  } else {
    const contact = await db.collection<Document & { _id: string }>("contacts").findOne({
      _id: String(userSession?.sub),
    });
    if (!contact || contact.disabled || contact.tokenVersion !== userSession?.tokenVersion) {
      return NextResponse.json({ error: "Account is unavailable." }, { status: 403 });
    }
    subscriber = { role: "user", contactId: String(contact._id) };
  }

  await db.collection("pushSubscriptions").updateOne(
    { "subscription.endpoint": parsed.data.endpoint },
    { $set: { ...subscriber, subscription: parsed.data, createdAt: new Date() } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
