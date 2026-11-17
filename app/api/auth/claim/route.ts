import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { isSameOrigin, SESSION_TTL_SECONDS, setCookie, signToken } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(20).max(100),
  name: z.string().trim().min(2).max(80),
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and enter a password." }, { status: 400 });
  const db = await getDb();
  const contacts = db.collection<Document & { _id: string }>("contacts");
  const inviteTokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const contact = await contacts.findOne({
    inviteTokenHash,
    passwordHash: "",
  });
  if (!contact) return NextResponse.json({ error: "Invite is invalid or has already been claimed." }, { status: 400 });
  if (await contacts.findOne({ username: parsed.data.username })) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const update = await contacts.updateOne(
    { _id: contact._id, inviteTokenHash: contact.inviteTokenHash, passwordHash: "" },
    { $set: { name: parsed.data.name, username: parsed.data.username, passwordHash }, $unset: { inviteTokenHash: "", inviteExpiresAt: "" } }
  );
  if (!update.modifiedCount) return NextResponse.json({ error: "Invite is no longer valid." }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  setCookie(
    response,
    "user_session",
    await signToken({ sub: String(contact._id), role: "user", tokenVersion: contact.tokenVersion ?? 0 }),
    { path: "/", maxAge: SESSION_TTL_SECONDS, secure: process.env.NODE_ENV === "production", sameSite: "strict" }
  );
  return response;
}
