"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { SESSION_COOKIE, isRole } from "@/lib/role";
import { safePath } from "@/lib/redirect";
import { clearFailures, isLocked, recordFailure } from "@/lib/rateLimit";
import { SESSION_MAX_AGE, createSessionToken } from "@/lib/auth";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import { getAuthClient } from "@/lib/prisma";
import { SCENARIOS, SCENARIO_COOKIE } from "@/lib/scenario";

const ONE_YEAR = 60 * 60 * 24 * 365;

function loginUrl(error: string, next: string) {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  return `/select-role?${params}`;
}

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase().slice(0, 40);
  const password = String(formData.get("password") ?? "").slice(0, MAX_PASSWORD_LENGTH);
  const next = String(formData.get("next") ?? "");

  const h = await headers();
  const client = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  // Throttle by address and by account, so one address can't try many
  // passwords and many addresses can't hammer one account.
  const keys = [client, `user:${username}`];
  if (keys.some(isLocked)) redirect(loginUrl("locked", next));

  const user = username ? await getAuthClient().user.findUnique({ where: { username } }) : null;
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || !user.active || !isRole(user.role)) {
    keys.forEach(recordFailure);
    redirect(loginUrl("invalid", next));
  }
  keys.forEach(clearFailures);

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken({ userId: user.id, role: user.role, name: user.name }), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });

  // Only follow same-site relative paths, and keep workers on their side.
  const safeNext = safePath(next);
  if (user.role === "worker") redirect(safeNext?.startsWith("/log") ? safeNext : "/log");
  redirect(safeNext ?? "/");
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/select-role");
}

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// Switches between the real farm and the 100-pond demo. Pond and farm ids
// differ between the two, so their pages are left for the section's top page.
export async function setScenario(formData: FormData) {
  const scenario = formData.get("scenario");
  if (typeof scenario !== "string" || !(SCENARIOS as readonly string[]).includes(scenario)) return;
  (await cookies()).set(SCENARIO_COOKIE, scenario, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  const from = safePath(formData.get("from")) ?? "/";
  revalidatePath("/", "layout");
  redirect(
    from.startsWith("/log") ? "/log" : from.startsWith("/farms/") ? "/farms" : from.startsWith("/ponds/") ? "/" : from,
  );
}
