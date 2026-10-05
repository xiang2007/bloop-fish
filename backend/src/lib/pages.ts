// What each screen of the web app needs, assembled from the database.
// One function per screen, called by the GET routes in routes/read.ts.
import { prisma } from "./prisma";
import { addDays, dateToDayKey, dayKeyToDate, todayKey } from "@fisheye/shared/dates";
import { suggestStocking } from "@fisheye/shared/cycle";
import { getI18n } from "./i18n";
import { getScenario, isLargeScenarioAvailable } from "./prisma";
import { getSession } from "./session";
import { getBoxKg } from "./settings";
import {
  getClosedCycles,
  getFarms,
  getFeedTypes,
  getHarvestLog,
  getMonthlyFeedCost,
  getOpenFindings,
  getPondDetail,
  getPondList,
  getPondsWithMetrics,
  getRecentActivity,
  getSizeGrades,
  getStockLevels,
  getWorkerDay,
} from "./queries";

// Sidebar: pond list, ponds ready to harvest, who is signed in, demo switch.
export async function navData() {
  const [entries, session, scenario, canSwitch] = await Promise.all([
    getPondsWithMetrics(),
    getSession(),
    getScenario(),
    isLargeScenarioAvailable(),
  ]);
  const ponds = entries.map(({ pond, farm }) => ({ id: pond.id, name: pond.name, farm }));
  const readyPonds = entries
    .filter((entry) => entry.harvestability === "ready")
    .map(({ pond, farm, metrics, cycle }) => ({
      id: pond.id,
      name: pond.name,
      farm: farm?.name ?? null,
      kg: metrics.estimatedHarvestKg,
      daysPast: cycle.state === "ready" && cycle.daysToHarvest < 0 ? -cycle.daysToHarvest : 0,
    }));
  return { ponds, readyPonds, userName: session?.name ?? null, scenario: canSwitch ? scenario : null };
}

export async function overviewData() {
  const today = todayKey();
  const [ponds, stock, batches, activity, farms, boxKg, monthCost] = await Promise.all([
    getPondsWithMetrics(today),
    getStockLevels(today),
    getOpenFindings(),
    getRecentActivity(6),
    getFarms(),
    getBoxKg(),
    getMonthlyFeedCost(today),
  ]);
  return { today, ponds, stock, batches, activity, farms, boxKg, monthCost };
}

export async function farmMapData() {
  const today = todayKey();
  const [ponds, farms, boxKg] = await Promise.all([getPondsWithMetrics(today), getFarms(), getBoxKg()]);
  return { today, ponds, farms, boxKg };
}

export async function harvestsData() {
  const [harvests, ponds, cycles] = await Promise.all([getHarvestLog(), getPondList(), getClosedCycles()]);
  return { harvests, ponds, cycles };
}

export async function inventoryData() {
  const [stock, movements] = await Promise.all([
    getStockLevels(todayKey()),
    prisma.stockMovement.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 30,
      include: { feedType: { select: { code: true } } },
    }),
  ]);
  return { stock, movements };
}

export async function settingsData() {
  const [ponds, feedTypes, farms, grades, boxKg] = await Promise.all([
    prisma.pond.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { dailyLogs: true } }, farm: { select: { name: true } } },
    }),
    prisma.feedType.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { dailyLogs: true } } } }),
    prisma.farm.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { ponds: true } } } }),
    prisma.sizeGrade.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { _count: { select: { lines: true } } } }),
    getBoxKg(),
  ]);
  return { ponds, feedTypes, farms, grades, boxKg };
}

export async function importData() {
  const [ponds, feedTypes] = await Promise.all([
    prisma.pond.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, _count: { select: { dailyLogs: true } } },
    }),
    prisma.feedType.findMany({ select: { code: true, packSizeKg: true, pricePerKg: true } }),
  ]);
  return { ponds, feedTypes };
}

// One pond with everything its five tabs need, or null for an unknown id.
export async function pondPageData(pondId: number) {
  const today = todayKey();
  const [detail, feedTypes, boxKg, grades, farms] = await Promise.all([
    getPondDetail(pondId, today),
    getFeedTypes(),
    getBoxKg(),
    getSizeGrades({ activeOnly: true }),
    getFarms(),
  ]);
  if (!detail) return null;
  const running = detail.cycle.state === "growing" || detail.cycle.state === "ready";
  const suggestion = running ? null : await stockingSuggestion(pondId, detail.pond.cycleMonths, today);
  return {
    today,
    detail,
    feedTypes,
    boxKg,
    grades,
    farms: farms.map((farm) => ({ id: farm.id, name: farm.name })),
    suggestion,
  };
}

// "Stock in Oct to harvest Jun 27, when no other pond is planned."
async function stockingSuggestion(pondId: number, cycleMonths: number, today: string) {
  const { t, fmt } = await getI18n();
  const others = (await getPondsWithMetrics(today)).filter((entry) => entry.pond.id !== pondId);
  if (!others.some(({ cycle }) => cycle.state === "growing" || cycle.state === "ready")) return null;
  const best = suggestStocking(others, cycleMonths, today);
  const when = best.stockMonth === today.slice(0, 7) ? t("suggest.thisMonth") : t("suggest.inMonth", { month: fmt.month(best.stockMonth, "long") });
  const clash =
    best.others.length === 0
      ? t("suggest.noClash")
      : t("suggest.alongside", { ponds: best.others.map((pond) => pond.name).join(", ") });
  return t("suggest.text", { when, month: fmt.month(best.harvestMonth, "long"), clash });
}

// Worker checklist for one day.
export async function logDayData(date: string) {
  const [ponds, session] = await Promise.all([getWorkerDay(date), getSession()]);
  return { ponds, session };
}

// One pond's entry form for one day: the last week of records, the latest
// sample, and the record before that week if the week is empty.
export async function logEntryData(pondId: number, date: string) {
  const [pond, feedTypes, session] = await Promise.all([
    prisma.pond.findUnique({
      where: { id: pondId },
      include: {
        dailyLogs: {
          where: { date: { lte: dayKeyToDate(date), gte: dayKeyToDate(addDays(date, -7)) } },
          orderBy: { date: "desc" },
          include: { feedType: { select: { code: true } } },
        },
        samplings: { orderBy: { date: "desc" }, take: 1 },
      },
    }),
    prisma.feedType.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    getSession(),
  ]);
  if (!pond) return null;
  const history = pond.dailyLogs.filter((log) => dateToDayKey(log.date) < date);
  const previous =
    history[0] ??
    (await prisma.dailyLog.findFirst({
      where: { pondId, date: { lt: dayKeyToDate(date) } },
      orderBy: { date: "desc" },
      include: { feedType: { select: { code: true } } },
    }));
  return { pond, feedTypes, session, previous };
}
