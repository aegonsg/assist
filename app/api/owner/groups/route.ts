import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const groupFields = z.object({
  name: z.string().trim().min(2).max(80),
  memberIds: z.array(z.string().uuid()).min(1).max(50),
});
const groupSchema = groupFields.refine((group) => new Set(group.memberIds).size === group.memberIds.length, {
  message: "Members must be unique.",
});

export async function GET() {
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const groups = await db.collection<Document & { _id: string; memberIds: string[] }>("groups").find({}).sort({ createdAt: -1 }).toArray();
  const groupIds = groups.map((group) => group._id);
  const memberIds = [...new Set(groups.flatMap((group) => group.memberIds))];
  const [contacts, messages] = await Promise.all([
    db.collection<Document & { _id: string }>("contacts").find(
      { _id: { $in: memberIds } },
      { projection: { name: 1, username: 1 } }
    ).toArray(),
    groupIds.length
      ? db.collection("groupMessages").find({ groupId: { $in: groupIds } }).sort({ createdAt: -1 }).limit(500).toArray()
      : Promise.resolve([]),
  ]);
  const contactById = new Map(contacts.map((contact) => [String(contact._id), contact]));
  const messagesByGroup = new Map<string, typeof messages>();
  for (const message of messages.reverse()) {
    const list = messagesByGroup.get(String(message.groupId)) ?? [];
    list.push(message);
    messagesByGroup.set(String(message.groupId), list);
  }
  return NextResponse.json({
    groups: groups.map((group) => ({
      _id: group._id,
      name: group.name,
      memberIds: group.memberIds,
      members: group.memberIds.map((id) => contactById.get(id)).filter(Boolean),
      messages: (messagesByGroup.get(String(group._id)) ?? []).map((message) => ({
        ...message,
        senderName: contactById.get(String(message.senderId))?.name ?? "Former member",
      })),
      createdAt: group.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = groupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a group name and select at least one member." }, { status: 400 });

  const db = await getDb();
  const activeContacts = await db.collection<Document & { _id: string }>("contacts").find({
    _id: { $in: parsed.data.memberIds },
    disabled: { $ne: true },
    passwordHash: { $ne: "" },
  }, { projection: { _id: 1 } }).toArray();
  if (activeContacts.length !== parsed.data.memberIds.length) {
    return NextResponse.json({ error: "Groups can include only active, registered contacts." }, { status: 400 });
  }

  const group = {
    _id: randomUUID(),
    name: parsed.data.name,
    memberIds: parsed.data.memberIds,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.collection<Document & { _id: string; memberIds: string[] }>("groups").insertOne(group);
  await db.collection("auditLogs").insertOne({ actor: "owner", action: "group_created", details: group._id, createdAt: new Date() });
  return NextResponse.json({ ok: true, group });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = groupFields.extend({ id: z.string().uuid() }).refine((group) => new Set(group.memberIds).size === group.memberIds.length, {
    message: "Members must be unique.",
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a group name and select at least one member." }, { status: 400 });

  const db = await getDb();
  const activeContacts = await db.collection<Document & { _id: string }>("contacts").find({
    _id: { $in: parsed.data.memberIds },
    disabled: { $ne: true },
    passwordHash: { $ne: "" },
  }, { projection: { _id: 1 } }).toArray();
  if (activeContacts.length !== parsed.data.memberIds.length) {
    return NextResponse.json({ error: "Groups can include only active, registered contacts." }, { status: 400 });
  }

  const updated = await db.collection<Document & { _id: string; memberIds: string[] }>("groups").updateOne(
    { _id: parsed.data.id },
    { $set: { name: parsed.data.name, memberIds: parsed.data.memberIds, updatedAt: new Date() } }
  );
  if (!updated.matchedCount) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  await db.collection("auditLogs").insertOne({ actor: "owner", action: "group_updated", details: parsed.data.id, createdAt: new Date() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid group." }, { status: 400 });

  const db = await getDb();
  await Promise.all([
    db.collection<Document & { _id: string; memberIds: string[] }>("groups").deleteOne({ _id: parsed.data.id }),
    db.collection("groupMessages").deleteMany({ groupId: parsed.data.id }),
  ]);
  await db.collection("auditLogs").insertOne({ actor: "owner", action: "group_deleted", details: parsed.data.id, createdAt: new Date() });
  return NextResponse.json({ ok: true });
}
