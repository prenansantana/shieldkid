import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/overview", "/verifications", "/settings"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect dashboard routes
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie
  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ??
    req.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate session by calling the auth API
  const sessionRes = await fetch(new URL("/api/auth/get-session", req.url), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
  });

  if (!sessionRes.ok) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await sessionRes.json();
  if (!session?.session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/overview/:path*", "/verifications/:path*", "/settings/:path*"],
};
