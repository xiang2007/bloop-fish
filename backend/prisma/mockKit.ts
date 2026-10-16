// Shared pieces of the demo-data scripts (mock.ts and scenario.ts): a
// seeded random generator, the growth and feeding curves, and the writer
// that fills a pond with a cycle of daily records.
import type { PrismaClient } from "../src/generated/prisma/client";
import { addDays, dayKeyToDate, daysBetween, todayKey } from "@fisheye/shared/dates";

// Small seeded generator so every run produces the same farm.
let seed = 20260927;
export function reseed(value: number) {
  seed = value;
}
export function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function jitter(value: number, spread: number) {
  return value * (1 + (random() * 2 - 1) * spread);
}

const CYCLE_DAYS = 243;

// Average weight in kg on a day of culture: fingerlings of a couple of grams
// reaching about 0.95 kg at eight months.
function weightOn(day: number, speed = 1) {
  return 0.002 + 0.95 * Math.pow(Math.min((day * speed) / CYCLE_DAYS, 1.3), 1.7);
}

// Share of body weight fed per day, falling as the fish grow.
function feedingRate(day: number) {
  // Calibrated so a full cycle lands near FCR 1.3–1.4.
  return Math.max(0.008, 0.03 - (0.022 * day) / CYCLE_DAYS);
}

function feedCodeFor(day: number) {
  if (day < 40) return "SM0120";
  if (day < 90) return "SM0220";
  if (day < 160) return "SM0320";
  return "SM0420";
}

export type MockPond = {
  name: string;
  farm: string;
  species: string;
  stockedAt: string;
  stockedCount: number;
  targetWeightKg: number;
  // Faster or slower growth than the standard curve.
  growth?: number;
  specs: { areaM2: number; depthM: number; pondType: string; waterSource: string; aerators: number };
  water: { status: "good" | "fair" | "poor"; note?: string; daysAgo: number };
  // Extra deaths on given days before today, e.g. a disease outbreak.
  deathSpikes?: { daysAgo: number; count: number }[];
  // Partial harvests of the running cycle (days before today, kg per grade label).
  harvests?: { daysAgo: number; grades: Record<string, [number, number]>; boxes?: number; note?: string }[];
  // A finished earlier cycle that ended some days before today.
  closedCycle?: {
    stockedAt: string;
    stockedCount: number;
    harvests: { date: string; grades: Record<string, [number, number]>; note?: string }[];
  };
  // A pond that is empty now (its last cycle was the closed one).
  empty?: boolean;
};

export const today = todayKey();
export const ago = (days: number) => addDays(today, -days);

export async function writeMockPonds(prisma: PrismaClient, ponds: MockPond[], log = true) {
  const feedTypes = await prisma.feedType.findMany();
  const feedByCode = new Map(feedTypes.map((feedType) => [feedType.code, feedType]));
  const grades = await prisma.sizeGrade.findMany();
  const gradeByLabel = new Map(grades.map((grade) => [grade.label, grade]));
  for (const code of ["SM0120", "SM0220", "SM0320", "SM0420"]) {
    if (!feedByCode.has(code)) throw new Error(`Feed type ${code} is missing; run the seed first.`);
  }

  const farms = new Map<string, number>();
  for (const name of new Set(ponds.map((pond) => pond.farm))) {
    const farm = await prisma.farm.upsert({ where: { name }, update: {}, create: { name } });
    farms.set(name, farm.id);
  }

  for (const mock of ponds) {
    const pond = await prisma.pond.upsert({ where: { name: mock.name }, update: {}, create: { name: mock.name } });

    // Start the mock pond from a clean slate.
    await prisma.$transaction([
      prisma.harvest.deleteMany({ where: { pondId: pond.id } }),
      prisma.pondCycle.deleteMany({ where: { pondId: pond.id } }),
      prisma.dailyLog.deleteMany({ where: { pondId: pond.id } }),
      prisma.sampling.deleteMany({ where: { pondId: pond.id } }),
    ]);

    await prisma.pond.update({
      where: { id: pond.id },
      data: {
        farmId: farms.get(mock.farm),
        species: mock.species,
        stockedAt: mock.empty ? null : dayKeyToDate(mock.stockedAt),
        stockedCount: mock.empty ? null : mock.stockedCount,
        targetWeightKg: mock.targetWeightKg,
        cycleMonths: 8,
        assumedFcr: 1.35,
        active: true,
        ...mock.specs,
        waterStatus: mock.water.status,
        waterNote: mock.water.note ?? null,
        waterCheckedAt: dayKeyToDate(ago(mock.water.daysAgo)),
      },
    });

    if (mock.closedCycle) {
      const cycle = mock.closedCycle;
      const endedAt = cycle.harvests.at(-1)!.date;
      const totals = await writeCycle(prisma, pond.id, cycle.stockedAt, cycle.stockedCount, endedAt, 1, [], feedByCode);
      const harvestKg = cycle.harvests.reduce((sum, harvest) => sum + gradeKg(harvest.grades), 0);
      const fishCount = cycle.harvests.reduce((sum, harvest) => sum + gradeFish(harvest.grades), 0);
      const closed = await prisma.pondCycle.create({
        data: {
          pondId: pond.id,
          number: 1,
          stockedAt: dayKeyToDate(cycle.stockedAt),
          stockedCount: cycle.stockedCount,
          endedAt: dayKeyToDate(endedAt),
          outcome: "harvested",
          harvestKg,
          fishCount,
          feedKg: totals.feedKg,
          feedCostRm: totals.feedCostRm,
          deadCount: totals.deadCount,
        },
      });
      for (const [index, harvest] of cycle.harvests.entries()) {
        await createHarvest(prisma, pond.id, closed.id, harvest.date, harvest.grades, index === cycle.harvests.length - 1, harvest.note, gradeByLabel);
      }
    }

    if (!mock.empty) {
      await writeCycle(prisma, pond.id, mock.stockedAt, mock.stockedCount, today, mock.growth ?? 1, mock.deathSpikes ?? [], feedByCode);
      for (const harvest of mock.harvests ?? []) {
        await createHarvest(prisma, pond.id, null, ago(harvest.daysAgo), harvest.grades, false, harvest.note, gradeByLabel, harvest.boxes);
      }
    }
    if (log) console.log(`${mock.name}: mock records written.`);
  }
}

// A stocktake and a delivery so the feed stock page has balances.
export async function writeMockStock(prisma: PrismaClient) {
  const feedByCode = new Map((await prisma.feedType.findMany()).map((feedType) => [feedType.code, feedType]));
  await prisma.stockMovement.deleteMany({ where: { note: { startsWith: "[mock]" } } });
  for (const [code, bags] of [["SM0120", 30], ["SM0220", 45], ["SM0320", 60], ["SM0420", 90]] as const) {
    const feedType = feedByCode.get(code)!;
    await prisma.stockMovement.create({ data: { feedTypeId: feedType.id, date: dayKeyToDate(ago(20)), kind: "count", bags, note: "[mock] Month-start count" } });
  }
  await prisma.stockMovement.create({
    data: { feedTypeId: feedByCode.get("SM0420")!.id, date: dayKeyToDate(ago(8)), kind: "delivery", bags: 120, note: "[mock] Delivery, invoice 4471" },
  });
}


function gradeKg(grades: Record<string, [number, number]>) {
  return Object.values(grades).reduce((sum, [kg]) => sum + kg, 0);
}
function gradeFish(grades: Record<string, [number, number]>) {
  return Object.values(grades).reduce((sum, [, fish]) => sum + fish, 0);
}

async function createHarvest(
  prisma: PrismaClient,
  pondId: number,
  cycleId: number | null,
  date: string,
  grades: Record<string, [number, number]>,
  isFinal: boolean,
  note: string | undefined,
  gradeByLabel: Map<string, { id: number }>,
  boxes?: number,
) {
  await prisma.harvest.create({
    data: {
      pondId,
      cycleId,
      date: dayKeyToDate(date),
      totalKg: gradeKg(grades),
      fishCount: gradeFish(grades),
      boxes: boxes ?? null,
      isFinal,
      note: note ?? null,
      recordedBy: "Owner",
      lines: {
        create: Object.entries(grades).map(([label, [kg, fishCount]]) => {
          const grade = gradeByLabel.get(label);
          if (!grade) throw new Error(`Size grade ${label} is missing.`);
          return { gradeId: grade.id, kg, fishCount };
        }),
      },
    },
  });
}

// Daily feed and deaths from stocking to the end date, plus a sampling about
// every 30 days, following the growth curve.
async function writeCycle(
  prisma: PrismaClient,
  pondId: number,
  stockedAt: string,
  stockedCount: number,
  endDate: string,
  growth: number,
  spikes: { daysAgo: number; count: number }[],
  feedByCode: Map<string, { id: number; packSizeKg: number; pricePerKg: number }>,
) {
  const logs = [];
  const samplings = [];
  let alive = stockedCount;
  const totals = { feedKg: 0, feedCostRm: 0, deadCount: 0 };
  const lastDay = daysBetween(stockedAt, endDate);

  for (let day = 1; day <= lastDay; day++) {
    const date = addDays(stockedAt, day);
    const weight = weightOn(day, growth);
    const feedType = feedByCode.get(feedCodeFor(day))!;
    const wantedKg = alive * weight * feedingRate(day) * jitter(1, 0.12);
    // Farm hands feed in half bags; the odd day is skipped for rain.
    const bags = random() < 0.03 ? 0 : Math.max(0.5, Math.round((wantedKg / feedType.packSizeKg) * 2) / 2);
    const spike = spikes.find((entry) => ago(entry.daysAgo) === date);
    // Routine losses stay at 1–2 a day so only the planned spikes read as an outbreak.
    const deadCount = spike ? spike.count : random() < 0.35 ? Math.floor(random() * 2) + 1 : 0;
    alive -= deadCount;

    const feedKg = bags * feedType.packSizeKg;
    const feedCostRm = feedKg * feedType.pricePerKg;
    totals.feedKg += feedKg;
    totals.feedCostRm += feedCostRm;
    totals.deadCount += deadCount;
    logs.push({
      pondId,
      date: dayKeyToDate(date),
      feedTypeId: bags > 0 ? feedType.id : null,
      bags,
      feedKg,
      feedCostRm,
      deadCount,
      note: spike ? "Many fish dead at the inlet, reduced feeding" : null,
      recordedBy: ["Ahmad", "Kumar", "Wei Jie"][day % 3],
      source: "app",
      // Saved in the evening of the day it records, so "recent entries" reads naturally.
      createdAt: new Date(`${date}T10:00:00.000Z`),
      updatedAt: new Date(`${date}T10:00:00.000Z`),
    });

    if (day % 30 === 0) {
      samplings.push({
        pondId,
        date: dayKeyToDate(date),
        avgWeightKg: Number(jitter(weight, 0.05).toFixed(4)),
        sampleSize: 20,
        recordedBy: "Ahmad",
        source: "app",
      });
    }
  }

  await prisma.dailyLog.createMany({ data: logs });
  await prisma.sampling.createMany({ data: samplings });
  return totals;
}

