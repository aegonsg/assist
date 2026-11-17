import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const saveSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("chat"),
    messageId: z.string().regex(/^[a-f\d]{24}$/i),
  }),
  z.object({
    sourceType: z.literal("group"),
    messageId: z.string().regex(/^[a-f\d]{24}$/i),
    groupId: z.string().uuid(),
  }),
]);
const deleteSchema = z.object({ id: z.string().uuid() });
type SavedMessageDocument = Document & {
  _id: string;
  ownerId: string;
  sourceType: "chat" | "group";
  sourceMessageId: string;
  senderName: string;
  text: string;
  createdAt: Date;
  savedAt: Date;
  groupId?: string;
  groupName?: string;
  role?: string;
};

async function getUserContext() {
  const session = await getSession("user_session", "user");
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = await getDb();
  const contactId = String(session.sub);
  const contact = await db.collection<Document & {
    _id: string;
    disabled?: boolean;
    tokenVersion: number;
    name: string;
  }>("contacts").findOne({ _id: contactId });
  if (!contact || contact.disabled || contact.tokenVersion !== session.tokenVersion) {
    return { response: NextResponse.json({ error: "Account is unavailable." }, { status: 403 }) };
  }
  return { db, contact, contactId };
}

export async function GET() {
  const context = await getUserContext();
  if ("response" in context) return context.response;

  const saved = await context.db.collection("savedMessages")
    .find({ ownerId: context.contactId })
    .sort({ savedAt: -1 })
    .toArray();
  return NextResponse.json({ messages: saved });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid message to save." }, { status: 400 });

  const context = await getUserContext();
  if ("response" in context) return context.response;

  const sourceId = new ObjectId(parsed.data.messageId);
  const now = new Date();
  let savedMessage: Omit<SavedMessageDocument, "_id" | "ownerId" | "savedAt">;

  if (parsed.data.sourceType === "chat") {
    const message = await context.db.collection("messages").findOne({
      _id: sourceId,
      contactId: context.contactId,
    });
    if (!message) return NextResponse.json({ error: "That message is no longer available to save." }, { status: 404 });

    if (message.role === "owner" && message.requestId) {
      const request = await context.db.collection<Document & { _id: string; contactId: string; category: string }>("requests").findOne({
        _id: String(message.requestId),
        contactId: context.contactId,
      });
      if (!request || request.category === "sensitive") {
        return NextResponse.json({ error: "This private reply cannot be saved." }, { status: 403 });
      }
    }

    savedMessage = {
      sourceType: "chat",
      sourceMessageId: String(message._id),
      role: message.role,
      senderName: message.role === "owner" ? "Owner reply" : message.role === "bot" ? "Assistant" : "You",
      text: message.text,
      createdAt: message.createdAt,
    };
  } else {
    const group = await context.db.collection<Document & { _id: string; name: string; memberIds: string[] }>("groups")
      .findOne({ _id: parsed.data.groupId, memberIds: context.contactId });
    if (!group) return NextResponse.json({ error: "You are not a member of this group." }, { status: 403 });

    const message = await context.db.collection("groupMessages").findOne({
      _id: sourceId,
      groupId: group._id,
    });
    if (!message) return NextResponse.json({ error: "That message is no longer available to save." }, { status: 404 });

    const sender = String(message.senderId) === context.contactId
      ? context.contact
      : await context.db.collection<Document & { _id: string; name: string }>("contacts")
        .findOne({ _id: String(message.senderId) }, { projection: { name: 1 } });
    savedMessage = {
      sourceType: "group",
      sourceMessageId: String(message._id),
      groupId: group._id,
      groupName: group.name,
      senderName: sender?.name ?? "Former member",
      text: message.text,
      createdAt: message.createdAt,
    };
  }

  const document = {
    _id: randomUUID(),
    ownerId: context.contactId,
    ...savedMessage,
    savedAt: now,
  };
  await context.db.collection<SavedMessageDocument>("savedMessages").updateOne(
    {
      ownerId: context.contactId,
      sourceType: savedMessage.sourceType,
      sourceMessageId: savedMessage.sourceMessageId,
    },
    { $setOnInsert: document },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a saved message to remove." }, { status: 400 });

  const context = await getUserContext();
  if ("response" in context) return context.response;

  const result = await context.db.collection<SavedMessageDocument>("savedMessages").deleteOne({
    _id: parsed.data.id,
    ownerId: context.contactId,
  });
  if (!result.deletedCount) return NextResponse.json({ error: "Saved message not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
