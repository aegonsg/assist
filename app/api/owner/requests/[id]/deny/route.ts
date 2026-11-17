import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";
import { notifyContact } from "@/lib/push";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const db = await getDb();
  const now = new Date();
  const requestRecord = await db.collection<Document & { _id: string }>("requests").findOneAndUpdate(
    { _id: id, status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "denied", ownerReply: "The owner is unable to help with this request.", repliedAt: now } },
    { returnDocument: "after" }
  );
  if (!requestRecord) return NextResponse.json({ error: "Request not found or already handled." }, { status: 404 });
  await Promise.all([
    db.collection("messages").insertOne({
      contactId: requestRecord.contactId,
      role: "owner",
      text: "The owner is unable to help with this request.",
      requestId: id,
      createdAt: now,
    }),
    db.collection("auditLogs").insertOne({ actor: "owner", action: "request_denied", details: id, createdAt: now }),
  ]);
  await notifyContact(String(requestRecord.contactId));
  return NextResponse.json({ ok: true });
}
