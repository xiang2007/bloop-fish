import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { LOCALE_COOKIE, isLocale } from "@fisheye/shared/i18n/config";
import { SESSION_COOKIE, isRole } from "@fisheye/shared/role";
import { safePath } from "@fisheye/shared/redirect";
import { SCENARIOS, SCENARIO_COOKIE } from "@fisheye/shared/scenario";
import { createSessionToken, sessionCookieOptions } from "../lib/auth";
import { clientIp } from "../lib/clientIp";
import { HttpError } from "../lib/http";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "../lib/password";
import { getAuthClient } from "../lib/prisma";
import { clearFailures, isLocked, recordFailure } from "../lib/rateLimit";
import { getSession, requireSession } from "../lib/session";

const ONE_YEAR = 60 * 60 * 24 * 365;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const sessionRoutes = new Hono();

// Who is signed in (null when nobody is).
sessionRoutes.get("/session", async (c) => c.json({ session: await getSession() }));

// Sign in with a username and password. Returns where the web app should go
// next; a wrong password or a throttled address is a 401 / 429 with a `code`
// the sign-in screen turns into a message.
sessionRoutes.post("/session", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase().slice(0, 40);
  const password = String(body.password ?? "").slice(0, MAX_PASSWORD_LENGTH);
  const next = String(body.next ?? "");

  // Three counters, so no single party can lock the owner out of the farm:
  //  - per address, which stops one machine spraying many accounts;
  //  - per account *and* address, which is the strict one (a stranger's bad
  //    guesses only lock their own address out of that account);
  //  - per account alone, set high, which caps guessing spread over many
  //    addresses without letting a handful of requests lock everyone out.
  // Without TRUSTED_PROXY_HOPS the address is unknown and the strict counter
  // covers every client of an account together.
  const ip = clientIp(c.req.raw.headers) ?? "unknown";
  const strictKey = `login:${username}:${ip}`;
  const limits = [
    { key: `login-ip:${ip}`, max: 20 },
    { key: strictKey, max: 5 },
    { key: `login-acct:${username}`, max: 50 },
  ];
  const keys = limits.map((limit) => limit.key);
  if (await isLocked(limits, LOGIN_WINDOW_MS)) return c.json({ error: "Too many attempts", code: "locked" }, 429);

  const user = username ? await getAuthClient().user.findUnique({ where: { username } }) : null;
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || !user.active || !isRole(user.role)) {
    await recordFailure(keys, LOGIN_WINDOW_MS);
    return c.json({ error: "Wrong username or password", code: "invalid" }, 401);
  }
  // Only the strict counter resets. Clearing the shared ones would let someone
  // with their own account wipe their failure count between guesses.
  await clearFailures([strictKey]);

  setCookie(
    c,
    SESSION_COOKIE,
    createSessionToken({ userId: user.id, role: user.role, name: user.name, version: user.sessionVersion }),
    sessionCookieOptions(),
  );

  // Only follow same-site relative paths, and keep workers on their side.
  const safeNext = safePath(next);
  if (user.role === "worker") return c.json({ redirect: safeNext?.startsWith("/log") ? safeNext : "/log" });
  return c.json({ redirect: safeNext ?? "/" });
});

sessionRoutes.delete("/session", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ redirect: "/select-role" });
});

// Ends this account's sessions on every device, including this one.
sessionRoutes.delete("/session/all", async (c) => {
  const session = await requireSession();
  await getAuthClient().user.update({ where: { id: session.userId }, data: { sessionVersion: { increment: 1 } } });
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ redirect: "/select-role" });
});

// Language of the screens and of validation messages.
sessionRoutes.put("/locale", async (c) => {
  const { locale } = await c.req.json().catch(() => ({}));
  if (!isLocale(locale)) throw new HttpError(400, "Unknown language");
  setCookie(c, LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "Lax" });
  return c.json({ ok: true });
});

// Real farm or the 100-pond demo.
sessionRoutes.put("/scenario", async (c) => {
  const { scenario } = await c.req.json().catch(() => ({}));
  if (typeof scenario !== "string" || !(SCENARIOS as readonly string[]).includes(scenario)) {
    throw new HttpError(400, "Unknown scenario");
  }
  setCookie(c, SCENARIO_COOKIE, scenario, { path: "/", maxAge: ONE_YEAR, sameSite: "Lax" });
  return c.json({ ok: true });
});
