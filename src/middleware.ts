import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_AUTH = ["/auth/signin", "/auth/signup", "/favicon.ico", "/_next", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes use separate admin_auth cookie
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const hasAdmin = request.cookies.get("admin_auth")?.value === "true";
    if (!hasAdmin) return NextResponse.redirect(new URL("/admin/login", request.url));
    return NextResponse.next();
  }

  const hasCeedAuth = request.cookies.get("ceed_auth")?.value === "1";
  const hasSupabaseAuth = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const isLoggedIn = hasCeedAuth || hasSupabaseAuth;

  if (pathname === "/") {
    if (isLoggedIn) return NextResponse.next();
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  if (isLoggedIn && (pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};