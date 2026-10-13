"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { SESSION_COOKIE, isRole } from "@/lib/role";
import { clientIp } from "@/lib/clientIp";
import { requireSession, startSession } from "@/lib/session";
import { safePath } from "@/lib/redirect";
import { clearFailures, isLocked, recordFailure } from "@/lib/rateLimit";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import { getAuthClient } from "@/lib/prisma";
import { SCENARIOS, SCENARIO_COOKIE } from "@/lib/scenario";

const ONE_YEAR = 60 * 60 * 24 * 365;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function loginUrl(error: string, next: string) {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  return `/select-role?${params}`;
}

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase().slice(0, 40);
  const password = String(formData.get("password") ?? "").slice(0, MAX_PASSWORD_LENGTH);
  const next = String(formData.get("next") ?? "");

  // Three counters, so no single party can lock the owner out of the farm:
  //  - per address, which stops one machine spraying many accounts;
  //  - per account *and* address, which is the strict one (a stranger's bad
  //    guesses only lock their own address out of that account);
  //  - per account alone, set high, which caps guessing spread over many
  //    addresses without letting a handful of requests lock everyone out.
  // Without TRUSTED_PROXY_HOPS the address is unknown and the strict counter
  // covers every client of an account together.
  const ip = clientIp(await headers()) ?? "unknown";
  const strictKey = `login:${username}:${ip}`;
  const limits = [
    { key: `login-ip:${ip}`, max: 20 },
    { key: strictKey, max: 5 },
    { key: `login-acct:${username}`, max: 50 },
  ];
  const keys = limits.map((limit) => limit.key);
  if (await isLocked(limits, LOGIN_WINDOW_MS)) redirect(loginUrl("locked", next));

  const user = username ? await getAuthClient().user.findUnique({ where: { username } }) : null;
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || !user.active || !isRole(user.role)) {
    await recordFailure(keys, LOGIN_WINDOW_MS);
    redirect(loginUrl("invalid", next));
  }
  // Only the strict counter resets. Clearing the shared ones would let someone
  // with their own account wipe their failure count between guesses.
  await clearFailures([strictKey]);

  await startSession(user);

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

// Ends this account's sessions on every device, including this one.
export async function signOutEverywhere() {
  const session = await requireSession();
  await getAuthClient().user.update({ where: { id: session.userId }, data: { sessionVersion: { increment: 1 } } });
  (await cookies()).delete(SESSION_COOKIE);
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
