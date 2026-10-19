import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parsePondReport } from "@fisheye/shared/import/pondReport";
import { buildImportPlan } from "@fisheye/shared/import/plan";
import { commitImportPlan } from "../src/lib/import/commit";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Feed catalog from the Pond 1 sheet's cost tables (price per kg, RM).
const feedTypes = [
  { code: "SM0120", packSizeKg: 20, pricePerKg: 4.35 },
  { code: "SM0125", packSizeKg: 25, pricePerKg: 4.35 },
  { code: "SM0220", packSizeKg: 20, pricePerKg: 4.05 },
  { code: "SM0320", packSizeKg: 20, pricePerKg: 3.85 },
  { code: "SM0420", packSizeKg: 20, pricePerKg: 3.8 },
  { code: "UP02", packSizeKg: 20, pricePerKg: 4.05 },
  { code: "UP03", packSizeKg: 20, pricePerKg: 3.8 },
  { code: "UP04", packSizeKg: 20, pricePerKg: 3.75 },
];

// The farm runs seven ponds; only Pond 1 has a digitised history so far.
const POND_COUNT = 7;
const POND_1_SHEET = path.join(process.cwd(), "data", "Pond 1 - Fish Pond Performance Report.csv");

async function main() {
  for (const feedType of feedTypes) {
    await prisma.feedType.upsert({
      where: { code: feedType.code },
      update: {},
      create: feedType,
    });
  }

  const farm = await prisma.farm.upsert({ where: { name: "Main farm" }, update: {}, create: { name: "Main farm" } });
  for (let number = 1; number <= POND_COUNT; number++) {
    await prisma.pond.upsert({
      where: { name: `Pond ${number}` },
      update: {},
      create: { name: `Pond ${number}`, farmId: farm.id },
    });
  }

  const pond1 = await prisma.pond.findUniqueOrThrow({
    where: { name: "Pond 1" },
    include: { _count: { select: { imports: true } } },
  });

  if (pond1._count.imports > 0) {
    console.log("Pond 1 spreadsheet already imported; skipping.");
  } else if (!existsSync(POND_1_SHEET)) {
    console.warn(`Pond 1 spreadsheet not found at ${POND_1_SHEET}; ponds created without history.`);
  } else {
    const parsed = parsePondReport(readFileSync(POND_1_SHEET, "utf8"));
    const catalog = await prisma.feedType.findMany();
    const plan = buildImportPlan(parsed, catalog);
    const result = await commitImportPlan(
      prisma,
      plan,
      { pondId: pond1.id },
      path.basename(POND_1_SHEET),
    );
    console.log(
      `Imported ${result.imported} daily records and ${plan.samplings.length} samplings into Pond 1 ` +
        `(${plan.findings.length} findings).`,
    );
  }

  console.log(`Seeded ${feedTypes.length} feed types and ${POND_COUNT} ponds.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
