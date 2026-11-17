import { NextResponse } from "next/server";
import { clearCookie, isSameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  clearCookie(response, "user_session");
  clearCookie(response, "owner_session");
  return response;
}
