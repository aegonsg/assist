import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ownerCookie = request.cookies.get("owner_session")?.value;
  const userCookie = request.cookies.get("user_session")?.value;

  if (pathname.startsWith("/owner")) {
    if (pathname === "/owner/login") return NextResponse.next();
    if (!ownerCookie) {
      return NextResponse.redirect(new URL("/owner/login", request.url));
    }
  }

  if (pathname.startsWith("/app")) {
    if (!userCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname.startsWith("/api/owner")) {
    if (!ownerCookie) {
      return NextResponse.json({ error: "Owner session required" }, { status: 401 });
    }
  }

  if (pathname.startsWith("/api/user")) {
    if (!userCookie) {
      return NextResponse.json({ error: "User session required" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/app/:path*", "/api/owner/:path*", "/api/user/:path*"],
};
