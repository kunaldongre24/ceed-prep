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

  // For Supabase auth, rely on client-side redirect (localStorage), not cookie
  // Only handle root -> redirect to signin
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};