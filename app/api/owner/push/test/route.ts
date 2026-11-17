import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession, isSameOrigin } from "@/lib/auth";
import { notifyOwner } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await getSession("owner_session", "owner"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await notifyOwner("Signal Vault test", "Browser notifications are connected.", randomUUID());
  if (!sent) return NextResponse.json({ error: "No active push subscription or VAPID configuration was found." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
