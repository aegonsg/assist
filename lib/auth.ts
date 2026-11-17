import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_TTL_SECONDS = 72 * 60 * 60;

function getSecret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function signToken(payload: Record<string, unknown>, ttl = "72h") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return payload;
}

export function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: { path?: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" }
) {
  response.cookies.set({
    name,
    value,
    httpOnly: options.httpOnly ?? true,
    secure: options.secure ?? true,
    sameSite: options.sameSite ?? "strict",
    path: options.path ?? "/",
    maxAge: options.maxAge ?? SESSION_TTL_SECONDS,
  });
}

export function clearCookie(response: NextResponse, name: string, path = "/") {
  response.cookies.set({
    name,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path,
    maxAge: 0,
  });
}

export async function getSessionFromCookie(name: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(name)?.value;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const requestHost = forwardedHost || request.headers.get("host") || requestUrl.host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    const requestProtocol = forwardedProtocol ? `${forwardedProtocol}:` : requestUrl.protocol;
    return originUrl.host === requestHost && originUrl.protocol === requestProtocol;
  } catch {
    return false;
  }
}

export async function getSession(name: string, role: "user" | "owner") {
  const session = await getSessionFromCookie(name);
  if (!session || session.role !== role || typeof session.sub !== "string") return null;
  return session;
}
