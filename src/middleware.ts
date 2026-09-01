import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_AUTH = ["/auth/signin", "/auth/signup", "/favicon.ico", "/_next", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes use separate admin_auth cookie, not Supabase
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const hasAdmin = request.cookies.get("admin_auth")?.value === "true";
    if (!hasAdmin) return NextResponse.redirect(new URL("/admin/login", request.url));
    return NextResponse.next();
  }

  const isPublic = PUBLIC_AUTH.some((p) => pathname.startsWith(p)) || pathname === "/";
  const hasAuth = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (pathname === "/") {
    if (hasAuth) return NextResponse.redirect(new URL("/test", request.url));
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  if (!hasAuth && !isPublic) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};