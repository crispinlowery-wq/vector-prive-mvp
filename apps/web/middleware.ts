import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth0, managedAuthConfigured } from "./lib/auth0";

export async function middleware(request: NextRequest) {
  if (!managedAuthConfigured) return NextResponse.next();

  const authResponse = await auth0.middleware(request);
  const path = request.nextUrl.pathname;
  if (path.startsWith("/auth")) return authResponse;

  if (path === "/login") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const session = await auth0.getSession(request);
  if (!session) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("returnTo", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return authResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|sw.js|images/vector-prive-vp-icon.png|apply).*)"],
};
