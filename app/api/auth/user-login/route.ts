import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { isSameOrigin, SESSION_TTL_SECONDS, setCookie, signToken } from "@/lib/auth";
import { clearLoginAttempts, isLoginRateLimited, recordLoginFailure } from "@/lib/rate-limit";

const schema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid username and password." }, { status: 400 });
  if (await isLoginRateLimited(request, parsed.data.username)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const db = await getDb();
  const contacts = db.collection<Document & { _id: string }>("contacts");
  const contact = await contacts.findOne({ username: parsed.data.username });
  if (
    !contact ||
    contact.disabled ||
    !(await bcrypt.compare(parsed.data.password, String(contact.passwordHash)))
  ) {
    await recordLoginFailure(request, parsed.data.username);
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await clearLoginAttempts(request, parsed.data.username);
  await contacts.updateOne(
    { _id: contact._id },
    { $set: { lastLoginAt: new Date(), lastActiveAt: new Date() } }
  );
  const response = NextResponse.json({ ok: true, name: contact.name });
  setCookie(
    response,
    "user_session",
    await signToken({ sub: String(contact._id), role: "user", tokenVersion: contact.tokenVersion ?? 0 }),
    { path: "/", maxAge: SESSION_TTL_SECONDS, secure: process.env.NODE_ENV === "production", sameSite: "strict" }
  );
  return response;
}
