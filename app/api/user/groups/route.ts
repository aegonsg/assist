import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession("user_session", "user");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const contact = await db.collection<Document & { _id: string }>("contacts").findOne({ _id: String(session.sub) });
  if (!contact || contact.disabled || contact.tokenVersion !== session.tokenVersion) {
    return NextResponse.json({ error: "Account is unavailable." }, { status: 403 });
  }

  const groups = await db.collection<Document & { _id: string; memberIds: string[] }>("groups").find({ memberIds: String(contact._id) }).sort({ createdAt: -1 }).toArray();
  const groupIds = groups.map((group) => String(group._id));
  const messages = groupIds.length
    ? await db.collection("groupMessages").find({ groupId: { $in: groupIds } }).sort({ createdAt: -1 }).limit(500).toArray()
    : [];
  const contactIds = [...new Set(groups.flatMap((group) => group.memberIds))];
  const members = await db.collection<Document & { _id: string }>("contacts").find(
    { _id: { $in: contactIds } },
    { projection: { name: 1, username: 1 } }
  ).toArray();
  const memberNames = new Map(members.map((member) => [String(member._id), member.name]));
  const messagesByGroup = new Map<string, typeof messages>();
  for (const message of messages.reverse()) {
    const list = messagesByGroup.get(String(message.groupId)) ?? [];
    list.push({ ...message, senderName: memberNames.get(String(message.senderId)) ?? "Former member" });
    messagesByGroup.set(String(message.groupId), list);
  }
  return NextResponse.json({
    currentUserId: String(contact._id),
    groups: groups.map((group) => ({
      _id: group._id,
      name: group.name,
      members: group.memberIds.map((id) => memberNames.get(id)).filter(Boolean),
      messages: messagesByGroup.get(String(group._id)) ?? [],
    })),
  });
}
