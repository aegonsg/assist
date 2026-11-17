import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requestedContactId = new URL(request.url).searchParams.get("contactId");
  if (requestedContactId && !z.string().uuid().safeParse(requestedContactId).success) {
    return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
  }
  const db = await getDb();
  const filter = requestedContactId ? { contactId: requestedContactId } : {};
  const messages = await db.collection("messages").find(filter).sort({ createdAt: -1 }).limit(200).toArray();
  const contacts = await db.collection("contacts").find({}, { projection: { name: 1, username: 1 } }).toArray();
  const contactNames = new Map(contacts.map((contact) => [String(contact._id), contact.name]));
  const orderedMessages = requestedContactId ? messages.reverse() : messages;
  return NextResponse.json({
    messages: orderedMessages.map((message) => ({
      ...message,
      contactId: String(message.contactId),
      contactName: contactNames.get(String(message.contactId)) ?? "Unknown contact",
    })),
  });
}
