import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Document } from "mongodb";
import { getDb } from "@/lib/db";
import { isSameOrigin, SESSION_TTL_SECONDS, setCookie, signToken } from "@/lib/auth";
import { clearLoginAttempts, isLoginRateLimited, recordLoginFailure } from "@/lib/rate-limit";

const schema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your owner credentials." }, { status: 400 });
  if (await isLoginRateLimited(request, parsed.data.username)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const configuredUsername = process.env.OWNER_USERNAME;
  const configuredPasswordHash = process.env.OWNER_PASSWORD_HASH;
  const db = await getDb();
  const profiles = db.collection<Document & { _id: string }>("ownerProfiles");
  const profile = await profiles.findOne({ _id: "primary-owner" });
  const username = typeof profile?.username === "string" ? profile.username : configuredUsername;
  const passwordHash = typeof profile?.passwordHash === "string" && profile.passwordHash
    ? profile.passwordHash
    : configuredPasswordHash;
  if (!username || !passwordHash) {
    return NextResponse.json({ error: "Owner login is not configured yet." }, { status: 503 });
  }
  if (
    parsed.data.username !== username ||
    !(await bcrypt.compare(parsed.data.password, passwordHash))
  ) {
    await recordLoginFailure(request, parsed.data.username);
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  await clearLoginAttempts(request, parsed.data.username);
  if (!profile?.passwordHash) {
    await profiles.updateOne(
      { _id: "primary-owner" },
      {
        $set: { name: process.env.OWNER_NAME ?? "ADHAVAN", username, passwordHash, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }
  const response = NextResponse.json({ ok: true });
  setCookie(
    response,
    "owner_session",
    await signToken({ sub: "owner", role: "owner" }),
    { path: "/", maxAge: SESSION_TTL_SECONDS, secure: process.env.NODE_ENV === "production", sameSite: "strict" }
  );
  return response;
}
