import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getRoutePolicy, isPublicPath } from "@/lib/auth/route-policy";

const STATIC_ASSET =
  /\.(?:ico|png|jpe?g|gif|svg|webp|css|js|map|txt|xml|woff2?|ttf|eot|webmanifest)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = isPublicPath(pathname);

  if (pathname.startsWith("/_next") || STATIC_ASSET.test(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (hasSession && (pathname === "/login" || pathname === "/setup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (hasSession && pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const policy = getRoutePolicy(pathname);
  if (policy && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
