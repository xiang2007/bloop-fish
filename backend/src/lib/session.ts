import { SESSION_COOKIE } from "@fisheye/shared/role";
import { verifySessionToken, type Session } from "./auth";
import { requestCookie } from "./context";
import { HttpError } from "./http";
import { getAuthClient } from "./prisma";

export type { Session };

// The cookie proves who signed in; the account row decides what they may do now,
// so deactivating a user or changing their role takes effect on the next request.
export async function getSession(): Promise<Session | null> {
  const token = verifySessionToken(requestCookie(SESSION_COOKIE));
  if (!token) return null;
  const user = await getAuthClient().user.findUnique({ where: { id: token.userId } });
  if (!user || !user.active || (user.role !== "owner" && user.role !== "worker")) return null;
  // A password reset, deactivation or "sign out everywhere" bumps the version and ends older cookies.
  if (user.sessionVersion !== token.version) return null;
  return { userId: user.id, role: user.role, name: user.name };
}

// The API can be called directly, not only through the web app, so every
// route re-checks the account rather than relying on the web app's redirects.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Not signed in");
  return session;
}

export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "owner") throw new HttpError(403, "Only farm owners can do this");
  return session;
}
