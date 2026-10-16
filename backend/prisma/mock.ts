// Demo data for Ponds 2–7, so every screen has something to show while only
// Pond 1 has a real history. Pond 1 is never touched.
//
//   npm run db:mock
//
// Each run replaces the mock ponds' records with a fresh set. It refuses to
// run against anything but a local database unless --force is passed, so
// made-up records never end up next to real ones.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ago, writeMockPonds, writeMockStock, type MockPond } from "./mockKit";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) && !process.argv.includes("--force")) {
  console.error("DATABASE_URL is not a local database. Pass --force to write mock data to it anyway.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PONDS: MockPond[] = [
  {
    // Nearly there and already partly harvested.
    name: "Pond 2",
    farm: "Main farm",
    species: "Red tilapia",
    stockedAt: ago(235),
    stockedCount: 7000,
    targetWeightKg: 0.9,
    specs: { areaM2: 2400, depthM: 1.5, pondType: "Earthen", waterSource: "River", aerators: 4 },
    water: { status: "good", daysAgo: 3 },
    harvests: [
      { daysAgo: 12, grades: { "9+": [620, 640], "7–9": [880, 1080] }, boxes: 3, note: "Sold to Ah Seng, RM 9.20/kg" },
    ],
  },
  {
    // Past its planned harvest and at target size: should show as ready.
    name: "Pond 3",
    farm: "Main farm",
    species: "Red tilapia",
    stockedAt: ago(262),
    stockedCount: 6000,
    targetWeightKg: 0.9,
    growth: 1.02,
    specs: { areaM2: 2000, depthM: 1.4, pondType: "Earthen", waterSource: "River", aerators: 3 },
    water: { status: "fair", note: "Green water, oxygen low at dawn", daysAgo: 5 },
  },
  {
    // Mid-cycle and healthy.
    name: "Pond 4",
    farm: "Main farm",
    species: "Red tilapia",
    stockedAt: ago(130),
    stockedCount: 8000,
    targetWeightKg: 0.9,
    specs: { areaM2: 3000, depthM: 1.6, pondType: "Lined", waterSource: "Well", aerators: 4 },
    water: { status: "good", daysAgo: 2 },
  },
  {
    // Young fish, recently stocked.
    name: "Pond 5",
    farm: "North site",
    species: "Jade perch",
    stockedAt: ago(70),
    stockedCount: 12000,
    targetWeightKg: 0.7,
    growth: 0.9,
    specs: { areaM2: 1600, depthM: 1.5, pondType: "Earthen", waterSource: "Rain and river", aerators: 2 },
    water: { status: "good", daysAgo: 6 },
  },
  {
    // Harvested in two lots a few months ago and waiting to be restocked.
    name: "Pond 6",
    farm: "North site",
    species: "Red tilapia",
    stockedAt: "",
    stockedCount: 0,
    targetWeightKg: 0.9,
    empty: true,
    specs: { areaM2: 1800, depthM: 1.5, pondType: "Earthen", waterSource: "River", aerators: 3 },
    water: { status: "good", daysAgo: 40 },
    closedCycle: {
      stockedAt: ago(390),
      stockedCount: 6500,
      harvests: [
        { date: ago(150), grades: { "9+": [1450, 1500], "7–9": [1180, 1420], "5–7": [260, 430] }, note: "First lot, big fish only" },
        { date: ago(138), grades: { "9+": [720, 760], "7–9": [1340, 1620], "5–7": [640, 1040], "3–5": [90, 210] }, note: "Final harvest" },
      ],
    },
  },
  {
    // Trouble: a death spike this week and poor water.
    name: "Pond 7",
    farm: "North site",
    species: "Red tilapia",
    stockedAt: ago(190),
    stockedCount: 6500,
    targetWeightKg: 0.9,
    growth: 0.92,
    specs: { areaM2: 2200, depthM: 1.3, pondType: "Earthen", waterSource: "River", aerators: 2 },
    water: { status: "poor", note: "Fish gasping at the surface in the morning, water brown", daysAgo: 1 },
    deathSpikes: [
      { daysAgo: 4, count: 18 },
      { daysAgo: 3, count: 41 },
      { daysAgo: 2, count: 27 },
    ],
  },
];

async function main() {
  await writeMockPonds(prisma, PONDS);
  await writeMockStock(prisma);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
