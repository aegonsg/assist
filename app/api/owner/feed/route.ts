import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const messages = await db.collection("messages").find({}).sort({ createdAt: -1 }).limit(200).toArray();
  const contacts = await db.collection("contacts").find({}, { projection: { name: 1, username: 1 } }).toArray();
  const contactNames = new Map(contacts.map((contact) => [String(contact._id), contact.name]));
  return NextResponse.json({
    messages: messages.map((message) => ({
      ...message,
      contactName: contactNames.get(String(message.contactId)) ?? "Unknown contact",
    })),
  });
}
