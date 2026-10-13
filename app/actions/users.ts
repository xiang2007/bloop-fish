"use server";

import { revalidatePath } from "next/cache";
import { getAuthClient } from "@/lib/prisma";
import { requireOwner, startSession } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, hashPassword, passwordProblem } from "@/lib/password";
import { isRole } from "@/lib/role";
import type { FormState } from "./logs";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

function text(formData: FormData, name: string, max: number) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

async function invalid(fieldErrors: Record<string, string>): Promise<FormState> {
  const { t } = await getI18n();
  return { status: "error", message: t("form.checkFields"), fieldErrors };
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const name = text(formData, "name", 40);
  const username = text(formData, "username", 30).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  const errors: Record<string, string> = {};
  if (!name) errors.name = t("users.nameRequired");
  if (!USERNAME_PATTERN.test(username)) errors.username = t("users.usernameRule");
  if (password.length > MAX_PASSWORD_LENGTH) errors.password = t("users.passwordRule", { n: MIN_PASSWORD_LENGTH });
  else {
    const problem = passwordProblem(password, [username, name]);
    if (problem === "short") errors.password = t("users.passwordRule", { n: MIN_PASSWORD_LENGTH });
    else if (problem === "weak") errors.password = t("users.passwordWeak");
  }
  if (!isRole(role)) errors.role = t("users.roleRequired");
  if (Object.keys(errors).length > 0) return invalid(errors);

  const db = getAuthClient();
  if (await db.user.findUnique({ where: { username } })) return invalid({ username: t("users.usernameTaken") });

  await db.user.create({ data: { name, username, role, passwordHash: await hashPassword(password) } });
  revalidatePath("/settings");
  return { status: "success", message: t("users.created", { name }) };
}

export async function saveUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireOwner();
  const { t } = await getI18n();
  const id = Number(formData.get("id"));
  const role = String(formData.get("role") ?? "");
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") ?? "");

  const errors: Record<string, string> = {};
  if (!isRole(role)) errors.role = t("users.roleRequired");
  if (Object.keys(errors).length > 0 || !isRole(role)) return invalid(errors);

  const db = getAuthClient();
  const user = Number.isInteger(id) ? await db.user.findUnique({ where: { id } }) : null;
  if (!user) return { status: "error", message: t("users.notFound") };

  if (password) {
    const problem = password.length > MAX_PASSWORD_LENGTH ? "short" : passwordProblem(password, [user.username, user.name]);
    if (problem === "short") return invalid({ password: t("users.passwordRule", { n: MIN_PASSWORD_LENGTH }) });
    if (problem === "weak") return invalid({ password: t("users.passwordWeak") });
  }

  // An owner can't lock themselves out, and the farm always keeps an owner.
  const losesOwner = user.role === "owner" && user.active && (role !== "owner" || !active);
  if (losesOwner) {
    if (user.id === me.userId) return { status: "error", message: t("users.notYourself") };
    const others = await db.user.count({ where: { role: "owner", active: true, NOT: { id: user.id } } });
    if (others === 0) return { status: "error", message: t("users.lastOwner") };
  }

  // A new password or a deactivation ends that person's existing sessions.
  const revoke = password !== "" || (user.active && !active);
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      role,
      active,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
      ...(revoke ? { sessionVersion: { increment: 1 } } : {}),
    },
  });
  // Changing your own password shouldn't sign you out of the screen you're on.
  if (revoke && updated.id === me.userId) await startSession(updated);
  revalidatePath("/settings");
  return { status: "success", message: t("form.saved") };
}
