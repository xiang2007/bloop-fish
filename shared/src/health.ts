import { addDays, dateToDayKey, daysBetween } from "./dates";
import { fcrRating, type CycleStatus } from "./cycle";
import type { PondMetrics } from "./metrics";
import type { MessageKey } from "./i18n/messages/en";

export type HealthLevel = "good" | "watch" | "risk";

// One reason behind the pond's health, as a message key and its values so
// it can be shown in any language.
export type HealthCheck = {
  level: HealthLevel;
  key: MessageKey;
  params?: Record<string, string | number>;
};

export type PondHealth = { level: HealthLevel; checks: HealthCheck[] };

const LEVEL_ORDER: Record<HealthLevel, number> = { good: 0, watch: 1, risk: 2 };

export const SAMPLING_INTERVAL_DAYS = 30;
export const WATER_CHECK_DAYS = 14;

type HealthPond = {
  stockedCount: number | null;
  assumedFcr: number;
  waterStatus: string | null;
  waterCheckedAt: Date | null;
};

// Rule-based read of how the running cycle is going, from what is recorded:
// survival, recent deaths, FCR, how current the records are and the water.
export function assessHealth(
  pond: HealthPond,
  metrics: PondMetrics,
  logs: { date: Date; deadCount: number }[],
  cycle: CycleStatus,
  today: string,
): PondHealth | null {
  if (cycle.state !== "growing" && cycle.state !== "ready") return null;
  const checks: HealthCheck[] = [];

  if (metrics.survivalRate !== null) {
    const percent = Math.round(metrics.survivalRate * 100);
    const level: HealthLevel = metrics.survivalRate < 0.7 ? "risk" : metrics.survivalRate < 0.85 ? "watch" : "good";
    checks.push({ level, key: "health.survival", params: { percent } });
  }

  const spike = findMortalitySpike(logs);
  if (spike) {
    checks.push({ level: "risk", key: "health.deathSpike", params: { count: spike.count, date: spike.date } });
  }

  if (metrics.realizedFcr !== null) {
    const rating = fcrRating(metrics.realizedFcr, pond.assumedFcr);
    checks.push({
      level: rating === "high" ? "risk" : rating === "watch" ? "watch" : "good",
      key: "health.fcr",
      params: { fcr: metrics.realizedFcr.toFixed(2), target: pond.assumedFcr },
    });
  }

  if (metrics.dailyGainKg !== null && metrics.dailyGainKg <= 0) {
    checks.push({ level: "watch", key: "health.noGrowth" });
  }

  if (metrics.daysSinceLastLog === null) {
    checks.push({ level: "watch", key: "health.noLogs" });
  } else if (metrics.daysSinceLastLog > 1) {
    checks.push({
      level: metrics.daysSinceLastLog > 3 ? "risk" : "watch",
      key: "health.logGap",
      params: { n: metrics.daysSinceLastLog },
    });
  }

  if (metrics.daysSinceSampling === null) {
    if (metrics.lastLogDate) checks.push({ level: "watch", key: "health.noSampling" });
  } else if (metrics.daysSinceSampling > SAMPLING_INTERVAL_DAYS) {
    checks.push({ level: "watch", key: "health.samplingDue", params: { n: metrics.daysSinceSampling } });
  }

  if (pond.waterStatus === "poor" || pond.waterStatus === "fair" || pond.waterStatus === "good") {
    const level: HealthLevel = pond.waterStatus === "poor" ? "risk" : pond.waterStatus === "fair" ? "watch" : "good";
    checks.push({ level, key: `health.water.${pond.waterStatus}` });
    if (pond.waterCheckedAt && daysBetween(dateToDayKey(pond.waterCheckedAt), today) > WATER_CHECK_DAYS) {
      checks.push({
        level: "watch",
        key: "health.waterStale",
        params: { n: daysBetween(dateToDayKey(pond.waterCheckedAt), today) },
      });
    }
  }

  const level = checks.reduce<HealthLevel>((worst, check) => (LEVEL_ORDER[check.level] > LEVEL_ORDER[worst] ? check.level : worst), "good");
  checks.sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);
  return { level, checks };
}

export type HarvestTiming = {
  plannedAt: string;
  daysToPlanned: number;
  targetKg: number | null;
  latestAbwKg: number | null;
  // Day the latest growth rate reaches the target weight, when it can be told.
  projectedAt: string | null;
  atTarget: boolean;
  // The earlier of the planned date and reaching target size.
  harvestBy: string;
  daysLeft: number;
};

// When the pond should be harvested: the planned end of the cycle, brought
// forward if the fish are on course to reach the target size sooner.
export function harvestTiming(
  pond: { targetWeightKg: number | null },
  metrics: PondMetrics,
  cycle: CycleStatus,
  today: string,
): HarvestTiming | null {
  if (cycle.state !== "growing" && cycle.state !== "ready") return null;
  const targetKg = pond.targetWeightKg ?? null;
  const latestAbwKg = metrics.latestSampling?.avgWeightKg ?? null;
  const atTarget = targetKg !== null && latestAbwKg !== null && latestAbwKg >= targetKg;

  let projectedAt: string | null = null;
  if (atTarget) projectedAt = metrics.latestSampling!.date;
  else if (targetKg !== null && latestAbwKg !== null && metrics.dailyGainKg !== null && metrics.dailyGainKg > 0) {
    const days = Math.ceil((targetKg - latestAbwKg) / metrics.dailyGainKg);
    // Beyond two years the growth rate isn't telling us anything useful.
    if (days < 730) projectedAt = addDays(metrics.latestSampling!.date, days);
  }

  const harvestBy = projectedAt && projectedAt < cycle.plannedHarvestAt ? projectedAt : cycle.plannedHarvestAt;
  return {
    plannedAt: cycle.plannedHarvestAt,
    daysToPlanned: cycle.daysToHarvest,
    targetKg,
    latestAbwKg,
    projectedAt,
    atTarget,
    harvestBy,
    daysLeft: daysBetween(today, harvestBy),
  };
}

// How close a pond is to harvest, for the farm map and the ready banner.
export type Harvestability = "ready" | "soon" | "harvesting" | "growing" | "empty" | "unset";

export const HARVEST_SOON_DAYS = 30;

export function harvestability(cycle: CycleStatus, timing: HarvestTiming | null, harvestedCount: number): Harvestability {
  if (cycle.state === "empty") return "empty";
  if (cycle.state === "unset") return "unset";
  if (cycle.state === "ready" || timing?.atTarget || (timing && timing.daysLeft <= 0)) return "ready";
  if (harvestedCount > 0) return "harvesting";
  if (timing && timing.daysLeft <= HARVEST_SOON_DAYS) return "soon";
  return "growing";
}

// Highest single-day count in the last 7 days of records that is at least 3
// fish and 3x the daily average of the 28 days before it.
export function findMortalitySpike(logs: { date: Date; deadCount: number }[]) {
  if (logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => a.date.getTime() - b.date.getTime());
  const last = dateToDayKey(sorted.at(-1)!.date);
  const recentFrom = addDays(last, -6);
  const baselineFrom = addDays(recentFrom, -28);

  const recent = sorted.filter((log) => dateToDayKey(log.date) >= recentFrom);
  const baselineTotal = sorted
    .filter((log) => {
      const key = dateToDayKey(log.date);
      return key >= baselineFrom && key < recentFrom;
    })
    .reduce((sum, log) => sum + log.deadCount, 0);
  const baseline = baselineTotal / 28;

  const worst = recent.reduce((max, log) => (log.deadCount > max.deadCount ? log : max), recent[0]);
  if (!worst || worst.deadCount < 3 || worst.deadCount < baseline * 3) return null;
  return { date: dateToDayKey(worst.date), count: worst.deadCount, baseline };
}
