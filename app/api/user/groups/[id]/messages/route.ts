import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const schema = z.object({ message: z.string().trim().min(1).max(2000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const session = await getSession("user_session", "user");
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message must be between 1 and 2,000 characters." }, { status: 400 });
  const { id } = await context.params;
  const db = await getDb();
  const contact = await db.collection<Document & { _id: string }>("contacts").findOne({ _id: String(session.sub) });
  if (!contact || contact.disabled || contact.tokenVersion !== session.tokenVersion) {
    return NextResponse.json({ error: "Account is unavailable." }, { status: 403 });
  }
  const group = await db.collection<Document & { _id: string; memberIds: string[] }>("groups").findOne({ _id: id, memberIds: String(contact._id) });
  if (!group) return NextResponse.json({ error: "You are not a member of this group." }, { status: 403 });

  const message = {
    groupId: id,
    senderId: String(contact._id),
    text: parsed.data.message,
    createdAt: new Date(),
  };
  await db.collection("groupMessages").insertOne(message);
  return NextResponse.json({ ok: true, message: { ...message, senderName: contact.name } });
}
