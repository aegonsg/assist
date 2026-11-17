import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { MongoServerError } from "mongodb";
import { getDb } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/auth";

const usernameSchema = z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/);
const schema = z.object({
  name: z.string().trim().min(2).max(80),
  username: usernameSchema,
});

export async function GET() {
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = await getDb();
  const contacts = await db.collection<Document & { _id: string }>("contacts").find({}, {
    projection: { inviteTokenHash: 0, passphraseHash: 0 },
  }).sort({ createdAt: -1 }).toArray();
  return NextResponse.json({
    contacts: contacts.map(({ passwordHash, ...contact }) => ({ ...contact, registered: Boolean(passwordHash) })),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.extend({ password: z.string().min(10).max(128) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, username, and password with at least 10 characters." }, { status: 400 });
  const db = await getDb();
  const contacts = db.collection<Document & { _id: string }>("contacts");
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const contact = {
    _id: randomUUID(),
    name: parsed.data.name,
    username: parsed.data.username,
    passwordHash,
    disabled: false,
    tokenVersion: 0,
    createdAt: new Date(),
  };
  try {
    await contacts.insertOne(contact);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json({ error: "That username already exists." }, { status: 409 });
    }
    throw error;
  }
  await db.collection("auditLogs").insertOne({
    actor: "owner",
    action: "contact_created_with_password",
    details: contact._id,
    createdAt: new Date(),
  });
  return NextResponse.json({ ok: true, registered: true });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = z.discriminatedUnion("action", [
    z.object({ action: z.literal("status"), id: z.string().uuid(), disabled: z.boolean() }),
    z.object({
      action: z.literal("profile"),
      id: z.string().uuid(),
      name: schema.shape.name,
      username: usernameSchema,
      password: z.string().min(10).max(128).optional(),
    }),
  ]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid contact update." }, { status: 400 });
  const db = await getDb();
  const contacts = db.collection<Document & { _id: string }>("contacts");
  if (parsed.data.action === "status") {
    const updated = await contacts.updateOne(
      { _id: parsed.data.id },
      { $set: { disabled: parsed.data.disabled }, $inc: { tokenVersion: 1 } }
    );
    if (!updated.matchedCount) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  } else {
    const duplicate = await contacts.findOne({ username: parsed.data.username, _id: { $ne: parsed.data.id } }, { projection: { _id: 1 } });
    if (duplicate) return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    try {
      const setFields: Record<string, string> = {
        name: parsed.data.name,
        username: parsed.data.username,
      };
      if (parsed.data.password) setFields.passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const updated = await contacts.updateOne(
        { _id: parsed.data.id },
        {
          $set: setFields,
          ...(parsed.data.password ? {
            $unset: { inviteTokenHash: "", inviteExpiresAt: "" },
            $inc: { tokenVersion: 1 },
          } : {}),
        }
      );
      if (!updated.matchedCount) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
      }
      throw error;
    }
    await db.collection("auditLogs").insertOne({
      actor: "owner",
      action: parsed.data.password ? "contact_profile_and_password_updated" : "contact_profile_updated",
      details: parsed.data.id,
      createdAt: new Date(),
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
  const db = await getDb();
  await db.collection<Document & { _id: string }>("contacts").deleteOne({ _id: parsed.data.id });
  await Promise.all([
    db.collection<Document & { _id: string; memberIds: string[] }>("groups").updateMany(
      { memberIds: parsed.data.id },
      [{ $set: {
        memberIds: {
          $filter: {
            input: "$memberIds",
            as: "memberId",
            cond: { $ne: ["$$memberId", parsed.data.id] },
          },
        },
        updatedAt: new Date(),
      } }]
    ),
    db.collection("pushSubscriptions").deleteMany({ role: "user", contactId: parsed.data.id }),
    db.collection("savedMessages").deleteMany({ ownerId: parsed.data.id }),
  ]);
  await db.collection("auditLogs").insertOne({ actor: "owner", action: "contact_deleted", details: parsed.data.id, createdAt: new Date() });
  return NextResponse.json({ ok: true });
}
