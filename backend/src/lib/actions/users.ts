import { isRole } from "@fisheye/shared/role";
import type { ActionResult } from "@fisheye/shared/forms";
import { getI18n } from "../i18n";
import type { Fields } from "../http";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, hashPassword, passwordProblem } from "../password";
import { getAuthClient } from "../prisma";
import { requireOwner } from "../session";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

function text(formData: Fields, name: string, max: number) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

async function invalid(fieldErrors: Record<string, string>): Promise<ActionResult> {
  const { t } = await getI18n();
  return { status: "error", message: t("form.checkFields"), fieldErrors };
}

export async function createUser(formData: Fields): Promise<ActionResult> {
  await requireOwner();
  const { t } = await getI18n();
  const name = text(formData, "name", 40);
  const username = text(formData, "username", 30).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  const errors: Record<string, string> = {};
  if (!name) errors.name = t("users.nameRequired");
  if (!USERNAME_PATTERN.test(username)) errors.username = t("users.usernameRule");
  if (password.length > MAX_PASSWORD_LENGTH || passwordProblem(password)) {
    errors.password = t("users.passwordRule", { n: MIN_PASSWORD_LENGTH });
  }
  if (!isRole(role)) errors.role = t("users.roleRequired");
  if (Object.keys(errors).length > 0) return invalid(errors);

  const db = getAuthClient();
  if (await db.user.findUnique({ where: { username } })) return invalid({ username: t("users.usernameTaken") });

  await db.user.create({ data: { name, username, role, passwordHash: await hashPassword(password) } });
  return { status: "success", message: t("users.created", { name }) };
}

// `reissue` is called with the account when you changed your own password, so
// the route can hand you a fresh cookie instead of signing you out.
export async function saveUser(
  formData: Fields,
  reissue: (user: { id: number; role: string; name: string; sessionVersion: number }) => void,
): Promise<ActionResult> {
  const me = await requireOwner();
  const { t } = await getI18n();
  const id = Number(formData.get("id"));
  const role = String(formData.get("role") ?? "");
  const active = ["on", "true"].includes(String(formData.get("active")));
  const password = String(formData.get("password") ?? "");

  const errors: Record<string, string> = {};
  if (!isRole(role)) errors.role = t("users.roleRequired");
  if (Object.keys(errors).length > 0 || !isRole(role)) return invalid(errors);

  const db = getAuthClient();
  const user = Number.isInteger(id) ? await db.user.findUnique({ where: { id } }) : null;
  if (!user) return { status: "error", message: t("users.notFound") };

  if (password && (password.length > MAX_PASSWORD_LENGTH || passwordProblem(password))) {
    return invalid({ password: t("users.passwordRule", { n: MIN_PASSWORD_LENGTH }) });
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
  if (revoke && updated.id === me.userId) reissue(updated);
  return { status: "success", message: t("form.saved") };
}
