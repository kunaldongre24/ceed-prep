import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/auth/signin", "/auth/signup", "/admin/login", "/favicon.ico", "/_next", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/";
  // Supabase auth cookie is sb-<ref>-auth-token
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