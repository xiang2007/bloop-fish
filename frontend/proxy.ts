import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isRole, type Role } from "@fisheye/shared/role";

const PUBLIC_PATHS = ["/select-role"];

// Scripts may only run if they carry this request's nonce, so injected markup
// can't execute. Style attributes are allowed because components set inline
// styles; stylesheets and <style> elements still need the nonce.
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// Passes the request on with the nonce and policy attached; Next.js reads the
// policy from the request headers and stamps the nonce on its own scripts.
function next(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Only for routing. The cookie is signed with a key the API holds, so this
// can't check the signature: it reads the role to send people to the right
// screen. The API verifies the cookie against the account on every request, so
// a forged cookie gets an empty page shell and nothing else.
function readSessionRole(token: string | undefined): { role: Role } | null {
  const payload = token?.split(".")[0];
  if (!payload) return null;
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return isRole(data.r) ? { role: data.r } : null;
  } catch {
    return null;
  }
}

function isWorkerPath(pathname: string) {
  return pathname === "/log" || pathname.startsWith("/log/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return next(request);
  }

  const session = readSessionRole(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/select-role";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session.role === "worker" && !isWorkerPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/log";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return next(request);
}

export const config = {
  // Static image files skip the proxy by name. Anything else, including a
  // route whose path happens to end in an extension, goes through the checks.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
