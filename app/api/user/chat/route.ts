import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";
import { notifyOwner } from "@/lib/push";
import { decideMessage, OWNER_REVIEW_REPLY } from "@/lib/assistant";

export const runtime = "nodejs";
const schema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const session = await getSession("user_session", "user");
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message must be between 1 and 2,000 characters." }, { status: 400 });

  const db = await getDb();
  const contacts = db.collection<Document & { _id: string }>("contacts");
  const contact = await contacts.findOne({ _id: String(session.sub) });
  if (!contact || contact.disabled || contact.tokenVersion !== session.tokenVersion) {
    return NextResponse.json({ error: "This account is unavailable. Contact the owner." }, { status: 403 });
  }
  const now = new Date();
  const message = parsed.data.message;
  await db.collection("messages").insertOne({
    contactId: String(contact._id),
    role: "user",
    text: message,
    createdAt: now,
  });
  await contacts.updateOne({ _id: contact._id }, { $set: { lastActiveAt: now } });

  const result = await decideMessage(message);
  const assistantReply = result.escalate ? OWNER_REVIEW_REPLY : result.reply;
  let requestId: string | undefined;
  let notificationsSent = false;
  if (result.escalate) {
    requestId = randomUUID();
    const category = /\b(stream\s*key|password|secret|credential|private key)\b/i.test(message)
      ? "sensitive"
      : result.category;
    await db.collection<Document & { _id: string }>("requests").insertOne({
      _id: requestId,
      contactId: String(contact._id),
      category,
      summary: result.summary,
      status: "pending",
      delivered: false,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    });
    await db.collection("auditLogs").insertOne({
      actor: String(contact._id),
      action: "request_created",
      details: category,
      createdAt: now,
    });
    notificationsSent = await notifyOwner(`${contact.name} needs you`, result.summary, requestId);
  }

  await db.collection("messages").insertOne({
    contactId: String(contact._id),
    role: "bot",
    text: assistantReply,
    requestId,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true, reply: assistantReply, requestId, notificationsSent });
}
