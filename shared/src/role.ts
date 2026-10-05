export type Role = "owner" | "worker";

export const ROLE_COOKIE = "fisheye_role";
export const NAME_COOKIE = "fisheye_name";

export function isRole(value: string | undefined): value is Role {
  return value === "owner" || value === "worker";
}
