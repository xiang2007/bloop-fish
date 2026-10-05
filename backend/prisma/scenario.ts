// Builds the "100 ponds" demo scenario: 100 ponds across 7 farms, written
// to their own Postgres schema so the real data is never touched. The app
// switches to it with the scenario button (see lib/prisma.ts).
//
//   npm run db:scenario
//
// Each run drops and rebuilds the schema. Like mock.ts it refuses to run
// against anything but a local database unless --force is passed.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { LARGE_SCENARIO_SCHEMA } from "@fisheye/shared/scenario";
import { dayKeyToDate } from "@fisheye/shared/dates";
import { ago, random, reseed, today, writeMockPonds, writeMockStock, type MockPond } from "./mockKit";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) && !process.argv.includes("--force")) {
  console.error("DATABASE_URL is not a local database. Pass --force to write the scenario to it anyway.");
  process.exit(1);
}

const SCHEMA = LARGE_SCENARIO_SCHEMA;

// Pond counts per farm add up to 100; ponds are numbered across the whole
// business so a pond number alone identifies a pond.
const FARMS: [string, number][] = [
  ["Sungai Besar", 18],
  ["Tanjung Karang", 16],
  ["Kuala Selangor", 15],
  ["Sabak Bernam", 14],
  ["Batu Pahat", 13],
  ["Muar", 12],
  ["Pontian", 12],
];

const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
const between = (low: number, high: number) => Math.round(low + random() * (high - low));

function buildPonds(): MockPond[] {
  const ponds: MockPond[] = [];
  let number = 0;
  for (const [farm, count] of FARMS) {
    for (let index = 0; index < count; index++) {
      number++;
      const species = random() < 0.8 ? "Red tilapia" : "Jade perch";
      const specs = {
        areaM2: between(12, 32) * 100,
        depthM: pick([1.3, 1.4, 1.5, 1.6]),
        pondType: random() < 0.75 ? "Earthen" : "Lined",
        waterSource: pick(["River", "River", "Well", "Rain and river"]),
        aerators: between(2, 5),
      };
      const roll = random();
      const water: MockPond["water"] =
        roll < 0.78
          ? { status: "good", daysAgo: between(1, 7) }
          : roll < 0.94
            ? { status: "fair", note: "Green water, oxygen low at dawn", daysAgo: between(1, 6) }
            : { status: "poor", note: "Fish gasping at the surface, water brown", daysAgo: between(1, 3) };
      const base = {
        name: `Pond ${number}`,
        farm,
        species,
        targetWeightKg: species === "Jade perch" ? 0.7 : 0.9,
        specs,
        water,
      };

      // About one pond in twelve is empty, waiting to be restocked.
      if (random() < 0.08) {
        const endedDaysAgo = between(10, 90);
        const stockedCount = between(55, 80) * 100;
        ponds.push({
          ...base,
          stockedAt: "",
          stockedCount: 0,
          empty: true,
          closedCycle: {
            stockedAt: ago(endedDaysAgo + between(235, 255)),
            stockedCount,
            harvests: [
              {
                date: ago(endedDaysAgo),
                grades: {
                  "9+": [between(1500, 2300), between(1550, 2400)],
                  "7–9": [between(2000, 2800), between(2400, 3400)],
                  "5–7": [between(500, 1000), between(800, 1600)],
                },
                note: "Final harvest",
              },
            ],
          },
        });
        continue;
      }

      const age = between(5, 265);
      const stockedCount = between(50, 120) * 100;
      ponds.push({
        ...base,
        stockedAt: ago(age),
        stockedCount,
        growth: 0.88 + random() * 0.2,
        deathSpikes:
          water.status === "poor"
            ? [
                { daysAgo: 3, count: between(15, 30) },
                { daysAgo: 2, count: between(25, 50) },
                { daysAgo: 1, count: between(10, 30) },
              ]
            : undefined,
        harvests:
          age > 225 && random() < 0.5
            ? [{ daysAgo: between(3, 15), grades: { "9+": [between(500, 800), between(520, 850)] }, note: "Big fish first" }]
            : undefined,
      });
    }
  }
  return ponds;
}

async function main() {
  reseed(1007);

  // Recreate the schema from the same migrations the real one uses.
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE; CREATE SCHEMA "${SCHEMA}"`);
  const migrations = path.join(process.cwd(), "prisma", "migrations");
  for (const folder of readdirSync(migrations).filter((name) => /^\d/.test(name)).sort()) {
    const sql = readFileSync(path.join(migrations, folder, "migration.sql"), "utf8").replace(
      'CREATE SCHEMA IF NOT EXISTS "public";',
      "",
    );
    await client.query(`SET search_path TO "${SCHEMA}"; ${sql}`);
  }
  // Same feed catalogue and prices as the real farm.
  await client.query(`
    INSERT INTO "${SCHEMA}".feed_types SELECT * FROM public.feed_types;
    SELECT setval(pg_get_serial_sequence('"${SCHEMA}".feed_types', 'id'), (SELECT max(id) FROM "${SCHEMA}".feed_types));
  `);
  await client.end();

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema: SCHEMA }) });
  const ponds = buildPonds();
  await writeMockPonds(prisma, ponds, false);
  await writeMockStock(prisma);
  // Leave today about half done, as if the morning round is still going.
  const unlogged = (await prisma.pond.findMany({ select: { id: true } })).filter(() => random() < 0.55).map((pond) => pond.id);
  await prisma.dailyLog.deleteMany({ where: { pondId: { in: unlogged }, date: dayKeyToDate(today) } });
  await prisma.$disconnect();
  console.log(`Scenario "${SCHEMA}": ${ponds.length} ponds across ${FARMS.length} farms.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
