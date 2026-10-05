import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { LOCALE_COOKIE, isLocale } from "@fisheye/shared/i18n/config";
import { NAME_COOKIE, ROLE_COOKIE, isRole } from "@fisheye/shared/role";
import { SCENARIOS, SCENARIO_COOKIE } from "@fisheye/shared/scenario";
import { HttpError } from "../lib/http";
import { getSession } from "../lib/session";

const ONE_YEAR = 60 * 60 * 24 * 365;

export const sessionRoutes = new Hono();

// Who is signed in (null when nobody is).
sessionRoutes.get("/session", async (c) => c.json({ session: await getSession() }));

// Sign in. There is no password: the body picks a role, and the role is
// stored in a cookie. Returns where the web app should go next.
sessionRoutes.post("/session", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const role = body.role;
  const name = String(body.name ?? "").trim().slice(0, 40);
  const next = String(body.next ?? "");
  if (typeof role !== "string" || !isRole(role)) throw new HttpError(400, "Choose a role to continue");

  const options = { path: "/", maxAge: ONE_YEAR, sameSite: "Lax" as const, httpOnly: true };
  setCookie(c, ROLE_COOKIE, role, options);
  if (name) setCookie(c, NAME_COOKIE, name, options);
  else deleteCookie(c, NAME_COOKIE, { path: "/" });

  // Only follow same-site relative paths.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (role === "worker") return c.json({ redirect: safeNext?.startsWith("/log") ? safeNext : "/log" });
  return c.json({ redirect: safeNext ?? "/" });
});

sessionRoutes.delete("/session", (c) => {
  deleteCookie(c, ROLE_COOKIE, { path: "/" });
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
