import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const schema = z.object({
  id: z.string().uuid(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a password of no more than 128 characters." }, { status: 400 });

  const db = await getDb();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const updated = await db.collection<Document & { _id: string }>("contacts").updateOne(
    { _id: parsed.data.id },
    {
      $set: { passwordHash },
      $unset: { inviteTokenHash: "", inviteExpiresAt: "" },
      $inc: { tokenVersion: 1 },
    }
  );
  if (!updated.matchedCount) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  await db.collection("auditLogs").insertOne({
    actor: "owner",
    action: "contact_password_set",
    details: parsed.data.id,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true });
}
