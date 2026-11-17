import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";
import { notifyContact } from "@/lib/push";

const schema = z.object({
  message: z.string().min(1).max(4000).refine((value) => value.trim().length > 0),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message must be between 1 and 4,000 characters." }, { status: 400 });

  const db = await getDb();
  const contact = await db.collection<Document & { _id: string; name: string; disabled?: boolean; passwordHash?: string }>("contacts")
    .findOne({ _id: id });
  if (!contact || !contact.passwordHash) return NextResponse.json({ error: "Registered contact not found." }, { status: 404 });
  if (contact.disabled) return NextResponse.json({ error: "This account is disabled." }, { status: 403 });

  const createdAt = new Date();
  const inserted = await db.collection("messages").insertOne({
    contactId: id,
    role: "owner",
    text: parsed.data.message,
    createdAt,
  });
  await Promise.all([
    db.collection<Document & { _id: string }>("contacts").updateOne({ _id: id }, { $set: { lastActiveAt: createdAt } }),
    db.collection("auditLogs").insertOne({
      actor: "owner",
      action: "owner_chat_message_sent",
      details: id,
      createdAt,
    }),
  ]);
  await notifyContact(id);
  return NextResponse.json({
    ok: true,
    message: {
      _id: String(inserted.insertedId),
      contactId: id,
      contactName: contact.name,
      role: "owner",
      text: parsed.data.message,
      createdAt,
    },
  });
}
