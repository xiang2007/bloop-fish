import { NextRequest, NextResponse } from "next/server";
import { ROLE_COOKIE, isRole } from "@fisheye/shared/role";

const PUBLIC_PATHS = ["/select-role"];

function isWorkerPath(pathname: string) {
  return pathname === "/log" || pathname.startsWith("/log/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || /\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (!isRole(role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/select-role";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (role === "worker" && !isWorkerPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/log";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
