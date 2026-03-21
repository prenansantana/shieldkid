import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/overview", "/verifications", "/settings"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if setup is needed (no admin users yet)
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/setup" ||
    protectedRoutes.some((route) => pathname.startsWith(route))
  ) {
    try {
      const statusRes = await fetch(
        new URL("/api/setup/status", req.url)
      );
      const { needsSetup } = await statusRes.json();

      if (needsSetup) {
        // Redirect everything to /setup if no admin exists
        if (pathname !== "/setup") {
          return NextResponse.redirect(new URL("/setup", req.url));
        }
        return NextResponse.next();
      }

      // Setup done — block access to /setup
      if (pathname === "/setup") {
        return NextResponse.redirect(new URL("/overview", req.url));
      }
    } catch {
      // If status check fails, continue normally
    }
  }

  // Protect dashboard routes
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
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
  matcher: [
    "/",
    "/login",
    "/setup",
    "/overview/:path*",
    "/verifications/:path*",
    "/settings/:path*",
  ],
};
