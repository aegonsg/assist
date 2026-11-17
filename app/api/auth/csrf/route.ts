import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET() {
  const token = randomUUID();
  const response = NextResponse.json({ csrfToken: token });
  response.cookies.set({
    name: "csrf_token",
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
