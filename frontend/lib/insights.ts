import { daysBetween } from "@fisheye/shared/dates";
import { LOW_STOCK_DAYS, type StockLevel } from "@fisheye/shared/inventory";
import type { PondWithMetrics } from "@backend/lib/queries";
import { formatNumber } from "@fisheye/shared/format";
import { fcrRating, harvestForecast, supplyGaps } from "@fisheye/shared/cycle";
import { SAMPLING_INTERVAL_DAYS, findMortalitySpike } from "@fisheye/shared/health";
import type { I18n } from "@fisheye/shared/i18n/translate";

export type Insight = {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href?: string;
};

const HARVEST_NOTICE_DAYS = 14;
const EMPTY_NOTICE_DAYS = 30;

// Rule-based checks an owner would otherwise do by scanning the sheet.
export function buildInsights(
  ponds: PondWithMetrics[],
  stock: StockLevel[],
  findingsCount: number,
  today: string,
  { t, fmt }: I18n,
): Insight[] {
  const insights: Insight[] = [];

  const n0 = (value: number) => formatNumber(value, 0);

  for (const { pond, metrics, logs, cycle, timing } of ponds) {
    const href = `/ponds/${pond.id}`;
    const cycleHref = `/ponds/${pond.id}?view=cycle`;
    const name = pond.name;

    if (cycle.state === "empty") {
      const days = daysBetween(cycle.since, today);
      if (days >= EMPTY_NOTICE_DAYS) {
        insights.push({
          severity: "info",
          title: t("insight.empty.title", { pond: name, n: days }),
          detail: t(cycle.lastOutcome === "lost" ? "insight.empty.lost" : "insight.empty.harvested", { date: fmt.dayKey(cycle.since) }),
          href: cycleHref,
        });
      }
      continue;
    }

    // Recorded deaths reaching the stocked count means nothing is left.
    if (pond.stockedCount && metrics.totals.deadCount >= pond.stockedCount) {
      insights.push({
        severity: "critical",
        title: t("insight.allDead.title", { pond: name }),
        detail: t("insight.allDead.detail", { dead: n0(metrics.totals.deadCount), stocked: n0(pond.stockedCount) }),
        href: cycleHref,
      });
    } else if (pond.stockedCount && metrics.totals.deadCount >= pond.stockedCount / 2) {
      insights.push({
        severity: "warning",
        title: t("insight.halfDead.title", { pond: name }),
        detail: t("insight.halfDead.detail", { dead: n0(metrics.totals.deadCount), stocked: n0(pond.stockedCount) }),
        href: cycleHref,
      });
    }

    if (metrics.realizedFcr !== null && fcrRating(metrics.realizedFcr, pond.assumedFcr) === "high") {
      insights.push({
        severity: "warning",
        title: t("insight.fcr.title", { pond: name, fcr: metrics.realizedFcr.toFixed(2), target: pond.assumedFcr }),
        detail: t("insight.fcr.detail", { feed: n0(metrics.totals.feedKg), fish: n0((metrics.samplingBiomassKg ?? 0) + metrics.harvested.kg) }),
        href,
      });
    }

    if (cycle.state === "ready") {
      insights.push({
        severity: "warning",
        title: t("insight.ready.title", { pond: name }),
        detail:
          cycle.daysToHarvest === 0
            ? t("insight.ready.today")
            : t("insight.ready.past", { n: -cycle.daysToHarvest, date: fmt.dayKey(cycle.plannedHarvestAt) }),
        href: cycleHref,
      });
    } else if (timing?.atTarget) {
      insights.push({
        severity: "warning",
        title: t("insight.atTarget.title", { pond: name }),
        detail: t("insight.atTarget.detail", { target: timing.targetKg ?? 0 }),
        href: cycleHref,
      });
    } else if (cycle.state === "growing" && cycle.daysToHarvest <= HARVEST_NOTICE_DAYS) {
      insights.push({
        severity: "info",
        title: t("insight.harvestSoon.title", { pond: name, n: cycle.daysToHarvest }),
        detail: t("insight.harvestSoon.detail", { date: fmt.dayKey(cycle.plannedHarvestAt) }),
        href: cycleHref,
      });
    }

    if (pond.waterStatus === "poor") {
      insights.push({
        severity: "critical",
        title: t("insight.water.title", { pond: name }),
        detail: pond.waterNote ?? t("insight.water.detail"),
        href: `${href}#specs`,
      });
    }

    if (metrics.lastLogDate && metrics.daysSinceLastLog !== null && metrics.daysSinceLastLog > 1) {
      insights.push({
        severity: metrics.daysSinceLastLog > 3 ? "critical" : "warning",
        title: t("insight.noEntries.title", { pond: name, n: metrics.daysSinceLastLog }),
        detail: t("insight.noEntries.detail", { date: fmt.dayKey(metrics.lastLogDate) }),
        href: "/log",
      });
    }

    if (
      metrics.lastLogDate &&
      metrics.daysSinceSampling !== null &&
      metrics.daysSinceSampling > SAMPLING_INTERVAL_DAYS - 5
    ) {
      insights.push({
        severity: "warning",
        title: t("insight.sampling.title", { pond: name }),
        detail: t("insight.sampling.detail", { date: fmt.dayKey(metrics.latestSampling!.date), n: metrics.daysSinceSampling }),
        href: `/log/${pond.id}`,
      });
    }

    const spike = findMortalitySpike(logs);
    if (spike) {
      insights.push({
        severity: "critical",
        title: t("insight.spike.title", { pond: name, date: fmt.dayKey(spike.date, { year: false }) }),
        detail: t("insight.spike.detail", { count: spike.count, baseline: formatNumber(spike.baseline, 1) }),
        href,
      });
    }

    if (metrics.lastLogDate && !pond.stockedCount) {
      insights.push({
        severity: "info",
        title: t("insight.noCount.title", { pond: name }),
        detail: t("insight.noCount.detail"),
        href: `/ponds/${pond.id}?view=settings`,
      });
    }
  }

  for (const level of stock) {
    if (!level.feedType.active || level.avgDailyBags === 0) continue;
    if (level.onHandBags === null) {
      insights.push({
        severity: "info",
        title: t("insight.noStocktake.title", { code: level.feedType.code }),
        detail: t("insight.noStocktake.detail", { rate: formatNumber(level.avgDailyBags, 1) }),
        href: "/inventory",
      });
    } else if (level.daysOfCover !== null && level.daysOfCover < LOW_STOCK_DAYS) {
      insights.push({
        severity: level.daysOfCover < 3 ? "critical" : "warning",
        title: t("insight.lowStock.title", { code: level.feedType.code, days: n0(level.daysOfCover) }),
        detail: t("insight.lowStock.detail", {
          onHand: formatNumber(Math.max(level.onHandBags, 0), 1),
          rate: formatNumber(level.avgDailyBags, 1),
        }),
        href: "/inventory",
      });
    }
  }

  const gaps = supplyGaps(harvestForecast(ponds, today));
  if (gaps.length > 0) {
    insights.push({
      severity: "warning",
      title: t("insight.gaps.title", { n: gaps.length }),
      detail: t("insight.gaps.detail", { months: gaps.map((month) => fmt.month(month.monthKey, "long")).join(", ") }),
      href: "/#cycles",
    });
  }

  if (findingsCount > 0) {
    insights.push({
      severity: "info",
      title: t("insight.findings.title", { n: findingsCount }),
      detail: t("insight.findings.detail"),
      href: ponds.find((entry) => entry.metrics.lastLogDate)
        ? `/ponds/${ponds.find((entry) => entry.metrics.lastLogDate)!.pond.id}?view=data`
        : "/import",
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}
