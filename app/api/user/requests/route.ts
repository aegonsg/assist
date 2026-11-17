import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Document } from "mongodb";

export async function GET() {
  const session = await getSession("user_session", "user");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const contact = await db.collection<Document & { _id: string }>("contacts").findOne({ _id: String(session.sub) });
  if (!contact || contact.disabled || contact.tokenVersion !== session.tokenVersion) {
    return NextResponse.json({ error: "Account is unavailable." }, { status: 403 });
  }
  const now = new Date();
  await db.collection("requests").updateMany(
    { contactId: String(contact._id), status: "pending", expiresAt: { $lte: now } },
    { $set: { status: "expired" } }
  );
  const [requests, messages] = await Promise.all([
    db.collection("requests").find({ contactId: String(contact._id) }).sort({ createdAt: -1 }).limit(50).toArray(),
    db.collection("messages").find({ contactId: String(contact._id) }).sort({ createdAt: 1 }).limit(200).toArray(),
  ]);
  const requestMap = new Map(requests.map((item) => [String(item._id), item]));
  const visibleMessages = await Promise.all(messages.map(async (message) => {
    if (message.role !== "owner" || !message.requestId) return message;
    const request = requestMap.get(String(message.requestId));
    if (request?.category !== "sensitive") return message;
    await db.collection("requests").updateOne(
      { _id: request._id, userViewedAt: { $exists: false } },
      { $set: { userViewedAt: now } }
    );
    return message;
  }));
  const safeRequests = requests.map((item) => {
    const safeItem = { ...item };
    Reflect.deleteProperty(safeItem, "ownerReply");
    return safeItem;
  });
  return NextResponse.json({ requests: safeRequests, messages: visibleMessages });
}
