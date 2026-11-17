import { NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const schema = z.object({
  text: z.string().min(1).max(4000).refine((value) => value.trim().length > 0),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message must be between 1 and 4,000 characters." }, { status: 400 });

  const db = await getDb();
  const messages = db.collection("messages");
  const message = await messages.findOne({ _id: new ObjectId(id), role: "owner" });
  if (!message) return NextResponse.json({ error: "Only owner-sent replies can be edited." }, { status: 404 });

  const editedAt = new Date();
  const result = await messages.updateOne(
    { _id: message._id, role: "owner" },
    { $set: { text: parsed.data.text, editedAt } }
  );
  if (!result.matchedCount) return NextResponse.json({ error: "Message could not be updated." }, { status: 409 });

  if (typeof message.requestId === "string") {
    await db.collection<Document & { _id: string; contactId: string }>("requests").updateOne(
      { _id: message.requestId, contactId: String(message.contactId) },
      { $set: { ownerReply: parsed.data.text, replyEditedAt: editedAt } }
    );
  }

  await db.collection("auditLogs").insertOne({
    actor: "owner",
    action: "owner_message_edited",
    details: id,
    createdAt: editedAt,
  });
  return NextResponse.json({ ok: true });
}
