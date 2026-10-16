import { prisma } from "./prisma";
import { DEFAULT_BOX_KG } from "@fisheye/shared/harvest";

export async function getBoxKg() {
  const row = await prisma.setting.findUnique({ where: { key: "boxKg" } });
  const value = Number(row?.value);
  return value > 0 ? value : DEFAULT_BOX_KG;
}
