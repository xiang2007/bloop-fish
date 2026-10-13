import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./role";
import { createSessionToken, sessionCookieOptions, verifySessionToken, type Session } from "./auth";
import { getAuthClient } from "./prisma";

export type { Session };

// The cookie proves who signed in; the account row decides what they may do now,
// so deactivating a user or changing their role takes effect on the next request.
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const user = await getAuthClient().user.findUnique({ where: { id: token.userId } });
  if (!user || !user.active || (user.role !== "owner" && user.role !== "worker")) return null;
  // A password reset, deactivation or "sign out everywhere" bumps the version and ends older cookies.
  if (user.sessionVersion !== token.version) return null;
  return { userId: user.id, role: user.role, name: user.name };
});

// Server Actions are reachable by direct POST, so each one re-checks the role
// rather than relying on the proxy redirect.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return session;
}

export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "owner") throw new Error("Only farm owners can do this");
  return session;
}

/** Issues the session cookie for an account, at its current sessionVersion. */
export async function startSession(user: { id: number; role: string; name: string; sessionVersion: number }) {
  if (user.role !== "owner" && user.role !== "worker") throw new Error("Unknown role");
  (await cookies()).set(
    SESSION_COOKIE,
    createSessionToken({ userId: user.id, role: user.role, name: user.name, version: user.sessionVersion }),
    sessionCookieOptions(),
  );
}
