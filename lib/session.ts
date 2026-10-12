import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./role";
import { verifySessionToken, type Session } from "./auth";
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
