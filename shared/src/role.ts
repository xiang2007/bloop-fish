export type Role = "owner" | "worker";

// Holds a signed token (see lib/auth.ts), not a bare role, so it can't be forged.
export const SESSION_COOKIE = "fisheye_session";

export function isRole(value: string | undefined | null): value is Role {
  return value === "owner" || value === "worker";
}
