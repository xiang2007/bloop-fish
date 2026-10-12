import { createHmac, timingSafeEqual } from "node:crypto";
import { isRole, type Role } from "./role";

export type Session = { userId: number; role: Role; name: string };

const SESSION_SECONDS = 60 * 60 * 24 * 14;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;
  // The fixed key is for `next dev` only; any other mode must set AUTH_SECRET.
  if (process.env.NODE_ENV !== "development") {
    throw new Error("AUTH_SECRET must be set to a random string of at least 16 characters");
  }
  return "fisheye-dev-only-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

// The token only says who signed in; lib/session.ts re-reads the account from
// the database, so a changed role or a deactivated account wins over the cookie.
export function createSessionToken(user: Session) {
  const payload = Buffer.from(
    JSON.stringify({ u: user.userId, r: user.role, n: user.name, e: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isInteger(data.u) || !isRole(data.r) || typeof data.n !== "string") return null;
    if (typeof data.e !== "number" || data.e < Date.now() / 1000) return null;
    return { userId: data.u, role: data.r, name: data.n.slice(0, 40) };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_SECONDS;
