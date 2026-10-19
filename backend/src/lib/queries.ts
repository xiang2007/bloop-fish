import { prisma } from "./prisma";
import { addMonths, dateToDayKey, dayKeyToDate, todayKey } from "@fisheye/shared/dates";
import { computePondMetrics, type PondMetrics } from "@fisheye/shared/metrics";
import { currentCycleStart, getCycleStatus } from "@fisheye/shared/cycle";
import { assessHealth, harvestTiming, harvestability } from "@fisheye/shared/health";
import { computeStockLevels } from "@fisheye/shared/inventory";
import type { Finding } from "@fisheye/shared/import/pondReport";

export async function getPondList() {
  return prisma.pond.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true, farm: { select: { id: true, name: true } } },
  });
}

export async function getFeedTypes({ activeOnly = false } = {}) {
  return prisma.feedType.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { code: "asc" },
  });
}

export async function getPondsWithMetrics(today = todayKey()) {
  const ponds = await prisma.pond.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    include: {
      dailyLogs: { include: { feedType: { select: { code: true } } } },
      samplings: true,
      cycles: { orderBy: { number: "desc" }, take: 1 },
      // Harvests of the running cycle; closed cycles carry their cycleId.
      harvests: { where: { cycleId: null }, orderBy: { date: "asc" } },
      farm: { select: { id: true, name: true } },
    },
  });

  return ponds.map(({ dailyLogs, samplings, cycles, harvests, farm, ...pond }) => {
    // Figures cover the running cycle only; earlier cycles are closed out.
    const start = currentCycleStart(pond, cycles[0]);
    const logs = inCycle(dailyLogs, start);
    const cycle = getCycleStatus(pond, cycles[0], today);
    const metrics = computePondMetrics(pond, logs, inCycle(samplings, start), today, harvests);
    const timing = harvestTiming(pond, metrics, cycle, today);
    return {
      pond,
      farm,
      logs,
      harvests,
      lastCycle: cycles[0] ?? null,
      cycle,
      metrics,
      timing,
      health: assessHealth(pond, metrics, logs, cycle, today),
      harvestability: harvestability(cycle, timing, metrics.harvested.count),
    };
  });
}

function inCycle<T extends { date: Date }>(rows: T[], start: string | null) {
  return start ? rows.filter((row) => dateToDayKey(row.date) >= start) : rows;
}

export type PondWithMetrics = Awaited<ReturnType<typeof getPondsWithMetrics>>[number];

export async function getStockLevels(today = todayKey()) {
  const [feedTypes, movements, usage] = await Promise.all([
    getFeedTypes(),
    prisma.stockMovement.findMany(),
    prisma.dailyLog.findMany({
      where: { bags: { gt: 0 } },
      select: { feedTypeId: true, date: true, bags: true },
    }),
  ]);

  // Usage rate is measured up to the most recent record so a paused pond
  // does not read as zero consumption.
  const latest = usage.reduce<string | null>((max, row) => {
    const key = dateToDayKey(row.date);
    return max === null || key > max ? key : max;
  }, null);
  const horizon = latest && latest < today ? latest : today;

  return {
    horizon,
    levels: computeStockLevels(feedTypes, movements, usage, horizon),
  };
}

export async function getRecentActivity(limit = 6) {
  return prisma.dailyLog.findMany({
    where: { source: "app" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      pond: { select: { id: true, name: true } },
      feedType: { select: { code: true } },
    },
  });
}

export async function getOpenFindings() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { importedAt: "desc" },
    include: { pond: { select: { id: true, name: true } } },
  });
  return batches.map((batch) => ({
    ...batch,
    findings: JSON.parse(batch.findings) as Finding[],
  }));
}

export async function getPondDetail(pondId: number, today = todayKey()) {
  const pond = await prisma.pond.findUnique({
    where: { id: pondId },
    include: {
      dailyLogs: {
        orderBy: { date: "asc" },
        include: { feedType: { select: { code: true, packSizeKg: true } } },
      },
      samplings: { orderBy: { date: "asc" } },
      imports: { orderBy: { importedAt: "desc" } },
      cycles: { orderBy: { number: "desc" } },
      harvests: { orderBy: { date: "asc" }, include: HARVEST_INCLUDE },
      farm: { select: { id: true, name: true } },
    },
  });
  if (!pond) return null;

  const { dailyLogs, samplings, imports, cycles, harvests, farm, ...rest } = pond;
  const start = currentCycleStart(rest, cycles[0]);
  const cycleLogs = inCycle(dailyLogs, start);
  const cycleSamplings = inCycle(samplings, start);
  const runningHarvests = harvests.filter((harvest) => harvest.cycleId === null);
  const metrics: PondMetrics = computePondMetrics(rest, cycleLogs, cycleSamplings, today, runningHarvests);
  const cycle = getCycleStatus(rest, cycles[0], today);
  const timing = harvestTiming(rest, metrics, cycle, today);

  return {
    pond: rest,
    farm,
    harvests,
    runningHarvests,
    timing,
    health: assessHealth(rest, metrics, cycleLogs, cycle, today),
    harvestability: harvestability(cycle, timing, metrics.harvested.count),
    // Every record, so the daily records view can browse earlier cycles.
    allLogs: dailyLogs,
    logs: cycleLogs,
    samplings: cycleSamplings,
    cycles,
    cycle,
    imports: imports.map((batch) => ({
      ...batch,
      findings: JSON.parse(batch.findings) as Finding[],
      summary: JSON.parse(batch.summary) as { totals: { days: number; feedKg: number; feedCostRm: number } },
    })),
    metrics,
  };
}

export async function getWorkerDay(dayKey: string) {
  const date = dayKeyToDate(dayKey);
  const ponds = await prisma.pond.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    include: {
      dailyLogs: {
        where: { date: { lte: date } },
        orderBy: { date: "desc" },
        take: 2,
        include: { feedType: { select: { code: true } } },
      },
      cycles: { orderBy: { number: "desc" }, take: 1 },
      farm: { select: { name: true } },
    },
  });

  return ponds.map(({ dailyLogs, cycles, farm, ...pond }) => {
    const today = dailyLogs.find((log) => dateToDayKey(log.date) === dayKey) ?? null;
    const previous = dailyLogs.find((log) => dateToDayKey(log.date) < dayKey) ?? null;
    return { pond, farm: farm?.name ?? null, today, previous, cycle: getCycleStatus(pond, cycles[0], dayKey) };
  });
}

const HARVEST_INCLUDE = {
  lines: {
    include: { grade: { select: { id: true, label: true, sortOrder: true } } },
    orderBy: { grade: { sortOrder: "asc" } },
  },
} as const;

// Every harvest on the farm, newest first, with the cycle it belongs to so
// the day of culture can be worked out.
export async function getHarvestLog() {
  const harvests = await prisma.harvest.findMany({
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: {
      ...HARVEST_INCLUDE,
      pond: { select: { id: true, name: true, stockedAt: true, farm: { select: { id: true, name: true } } } },
      cycle: { select: { number: true, stockedAt: true } },
    },
  });
  return harvests.map((harvest) => ({
    ...harvest,
    // Running-cycle harvests are dated from the pond's current stocking.
    stockedAt: harvest.cycle?.stockedAt ?? harvest.pond.stockedAt,
  }));
}

export type HarvestLogEntry = Awaited<ReturnType<typeof getHarvestLog>>[number];

export async function getSizeGrades({ activeOnly = false } = {}) {
  return prisma.sizeGrade.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function getFarms() {
  return prisma.farm.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { ponds: true } } } });
}

// Feed cost and weight for the whole farm this month and last month, from
// every daily record, including ponds harvested part-way through the month.
export async function getMonthlyFeedCost(today = todayKey()) {
  const thisMonth = today.slice(0, 7);
  const lastMonth = addMonths(thisMonth, -1);
  const logs = await prisma.dailyLog.findMany({
    where: { date: { gte: dayKeyToDate(`${lastMonth}-01`) } },
    select: { pondId: true, date: true, feedKg: true, feedCostRm: true },
  });
  const empty = () => ({ costRm: 0, feedKg: 0, byPond: {} as Record<number, number> });
  const months = { [thisMonth]: empty(), [lastMonth]: empty() };
  for (const log of logs) {
    const month = months[dateToDayKey(log.date).slice(0, 7)];
    if (!month) continue;
    month.costRm += log.feedCostRm;
    month.feedKg += log.feedKg;
    month.byPond[log.pondId] = (month.byPond[log.pondId] ?? 0) + log.feedCostRm;
  }
  return {
    thisMonth: { monthKey: thisMonth, ...months[thisMonth] },
    lastMonth: { monthKey: lastMonth, ...months[lastMonth] },
  };
}

// Closed cycles with how many harvests they took, newest first.
export async function getClosedCycles() {
  return prisma.pondCycle.findMany({
    orderBy: { endedAt: "desc" },
    include: { pond: { select: { id: true, name: true, assumedFcr: true } }, _count: { select: { harvests: true } } },
  });
}
