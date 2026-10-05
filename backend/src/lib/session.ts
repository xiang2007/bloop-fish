import { NAME_COOKIE, ROLE_COOKIE, isRole, type Role } from "@fisheye/shared/role";
import { requestCookie } from "./context";
import { HttpError } from "./http";

export type Session = { role: Role; name: string | null };

export async function getSession(): Promise<Session | null> {
  const role = requestCookie(ROLE_COOKIE);
  if (!isRole(role)) return null;
  const name = requestCookie(NAME_COOKIE)?.trim();
  return { role, name: name ? name.slice(0, 40) : null };
}

// There is no password: the role is a cookie chosen on the sign-in screen
// (see docs). Every write still checks it here, because the API can be
// called directly, not only through the web app.
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
