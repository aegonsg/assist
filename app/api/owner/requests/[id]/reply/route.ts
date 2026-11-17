import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";
import { notifyContact } from "@/lib/push";

const schema = z.object({ reply: z.string().trim().min(1).max(4000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Reply is required and must be under 4,000 characters." }, { status: 400 });
  const formattedReply = parsed.data.reply
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split(/\r?\n/).map((line) => line.trim()).join("\n").trim())
    .filter(Boolean)
    .join("\n\n");
  const { id } = await context.params;
  const db = await getDb();
  const now = new Date();
  const requestRecord = await db.collection<Document & { _id: string }>("requests").findOneAndUpdate(
    { _id: id, status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "replied", ownerReply: formattedReply, repliedAt: now, delivered: true } },
    { returnDocument: "after" }
  );
  if (!requestRecord) return NextResponse.json({ error: "Request not found or already handled." }, { status: 404 });
  await Promise.all([
    db.collection("messages").insertOne({
      contactId: requestRecord.contactId,
      role: "owner",
      text: formattedReply,
      requestId: id,
      createdAt: now,
    }),
    db.collection("auditLogs").insertOne({
      actor: "owner",
      action: "request_replied",
      details: id,
      createdAt: now,
    }),
  ]);
  await notifyContact(String(requestRecord.contactId));
  return NextResponse.json({ ok: true });
}
