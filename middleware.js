import { NextResponse } from "next/server";

// Lightweight presence check only (Edge runtime can't run Node's crypto scrypt).
// The actual signature is verified server-side in every API route via lib/auth.js.
export function middleware(req) {
  const hasSession = req.cookies.get("session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
