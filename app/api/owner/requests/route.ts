import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  await db.collection("requests").updateMany(
    { status: "pending", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } }
  );
  const requests = await db.collection("requests").find({}).sort({ status: 1, createdAt: -1 }).limit(100).toArray();
  const contacts = await db.collection("contacts").find({}, { projection: { name: 1, username: 1 } }).toArray();
  const contactNames = new Map(contacts.map((contact) => [String(contact._id), contact.name]));
  return NextResponse.json({
    requests: requests.map((item) => ({
      ...item,
      contactName: contactNames.get(String(item.contactId)) ?? "Unknown contact",
    })),
  });
}
