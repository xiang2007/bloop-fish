import { addMonths, dateToDayKey, formatMonth, lastDayOfMonth } from "../dates";
import { formatRm } from "../format";
import type { Finding, ParsedPondReport } from "./pondReport";

export type FeedCatalogEntry = {
  code: string;
  packSizeKg: number;
  pricePerKg: number;
};

export type PlannedLog = {
  date: string;
  feedCode: string | null;
  bags: number;
  feedKg: number;
  feedCostRm: number;
  deadCount: number;
};

export type PlannedSampling = {
  date: string;
  avgWeightKg: number;
};

export type PlanMonth = {
  monthKey: string;
  cultureMonth: number;
  days: number;
  bags: number;
  feedKg: number;
  feedCostRm: number;
  deadCount: number;
};

export type ImportTotals = {
  months: number;
  days: number;
  bags: number;
  feedKg: number;
  feedCostRm: number;
  deadCount: number;
  samplings: number;
};

export type ImportPlan = {
  stockedAt: string;
  logs: PlannedLog[];
  samplings: PlannedSampling[];
  newFeedTypes: FeedCatalogEntry[];
  months: PlanMonth[];
  totals: ImportTotals;
  findings: Finding[];
};

const DEFAULT_PACK_SIZE_KG = 20;

// Turns a parsed sheet into rows ready to insert, pricing each day with the
// price listed in that month's cost table (falling back to the catalog) and
// reconciling the recomputed costs against the sheet's own figures.
export function buildImportPlan(
  parsed: ParsedPondReport,
  catalog: FeedCatalogEntry[],
): ImportPlan {
  const findings: Finding[] = [...parsed.findings];
  const known = new Map(catalog.map((entry) => [entry.code, entry]));
  const newFeedTypes: FeedCatalogEntry[] = [];

  const usedCodes = new Set(
    parsed.months.flatMap((month) => month.days.map((day) => day.feedCode)).filter(Boolean) as string[],
  );

  for (const code of usedCodes) {
    if (known.has(code)) continue;
    const lines = parsed.months.flatMap((month) => month.costTable.filter((line) => line.feedCode === code));
    const packSizes = lines
      .filter((line) => line.bags && line.weightKg)
      .map((line) => Math.round((line.weightKg as number) / (line.bags as number)));
    const packSizeKg = mode(packSizes) ?? DEFAULT_PACK_SIZE_KG;
    const pricePerKg = lines.find((line) => line.pricePerKg)?.pricePerKg ?? 0;
    const entry = { code, packSizeKg, pricePerKg };
    known.set(code, entry);
    newFeedTypes.push(entry);
    findings.push({
      severity: pricePerKg ? "info" : "warning",
      title: `New feed type ${code}`,
      detail: pricePerKg
        ? `Added to the catalog at ${formatRm(pricePerKg)}/kg in ${packSizeKg} kg bags, based on the cost tables.`
        : `Added to the catalog in ${packSizeKg} kg bags with no price. Set its price in Settings to cost it.`,
    });
  }

  const logs: PlannedLog[] = [];
  const months: PlanMonth[] = [];

  for (const month of parsed.months) {
    const monthName = formatMonth(month.monthKey, "long");
    const monthPrices = new Map(
      month.costTable
        .filter((line) => line.pricePerKg !== null)
        .map((line) => [line.feedCode, line.pricePerKg as number]),
    );

    for (const line of month.costTable) {
      const entry = known.get(line.feedCode);
      if (!entry || !line.bags || !line.weightKg) continue;
      const listedPack = line.weightKg / line.bags;
      if (Math.abs(listedPack - entry.packSizeKg) > 0.01) {
        findings.push({
          severity: "warning",
          monthKey: month.monthKey,
          title: `${monthName}: ${line.feedCode} costed at ${round(listedPack)} kg per bag`,
          detail: `The cost table lists ${line.bags} bags as ${line.weightKg} kg, but ${line.feedCode} comes in ${entry.packSizeKg} kg bags. Weights and costs were recalculated at ${entry.packSizeKg} kg per bag.`,
        });
      }
    }

    const summary: PlanMonth = {
      monthKey: month.monthKey,
      cultureMonth: month.cultureMonth,
      days: 0,
      bags: 0,
      feedKg: 0,
      feedCostRm: 0,
      deadCount: 0,
    };

    for (const day of month.days) {
      const entry = day.feedCode ? known.get(day.feedCode) : undefined;
      const feedKg = entry ? day.bags * entry.packSizeKg : 0;
      const pricePerKg =
        (day.feedCode ? monthPrices.get(day.feedCode) : undefined) ?? entry?.pricePerKg ?? 0;
      const log: PlannedLog = {
        date: day.date,
        feedCode: day.feedCode,
        bags: day.bags,
        feedKg: round(feedKg),
        feedCostRm: round(feedKg * pricePerKg),
        deadCount: day.deadCount,
      };
      logs.push(log);
      summary.days += 1;
      summary.bags += log.bags;
      summary.feedKg += log.feedKg;
      summary.feedCostRm += log.feedCostRm;
      summary.deadCount += log.deadCount;
    }

    const reported = parsed.summaryRows.find((row) => row.cultureMonth === month.cultureMonth);
    if (reported?.feedCostRm != null && Math.abs(reported.feedCostRm - summary.feedCostRm) >= 0.5) {
      const difference = summary.feedCostRm - reported.feedCostRm;
      findings.push({
        severity: "warning",
        monthKey: month.monthKey,
        title: `${monthName}: feed cost differs by ${formatRm(Math.abs(difference))}`,
        detail: `The sheet reports ${formatRm(reported.feedCostRm)}; the daily rows cost ${formatRm(summary.feedCostRm)} at the listed prices (${difference > 0 ? "under" : "over"}-reported by ${formatRm(Math.abs(difference))}).`,
      });
    }

    months.push(summary);
  }

  const loggedMonths = new Set(parsed.months.map((month) => month.cultureMonth));
  const samplings: PlannedSampling[] = parsed.summaryRows
    .filter((row) => row.avgWeightKg !== null && row.avgWeightKg > 0 && loggedMonths.has(row.cultureMonth))
    .map((row) => ({
      date: dateToDayKey(lastDayOfMonth(addMonths(parsed.stockedMonthKey, row.cultureMonth))),
      avgWeightKg: row.avgWeightKg as number,
    }));

  const totals: ImportTotals = {
    months: months.length,
    days: logs.length,
    bags: round(sum(logs, (log) => log.bags)),
    feedKg: round(sum(logs, (log) => log.feedKg)),
    feedCostRm: round(sum(logs, (log) => log.feedCostRm)),
    deadCount: sum(logs, (log) => log.deadCount),
    samplings: samplings.length,
  };

  const reportedFeed = parsed.reportedTotals?.totalFeedKg;
  if (reportedFeed != null && Math.abs(reportedFeed - totals.feedKg) >= 0.5) {
    findings.push({
      severity: "warning",
      title: `Total feed differs from the sheet summary`,
      detail: `The sheet summary reports ${reportedFeed.toLocaleString("en-MY")} kg consumed; the daily rows add up to ${totals.feedKg.toLocaleString("en-MY")} kg.`,
    });
  }

  const firstDay = logs.map((log) => log.date).sort()[0];
  const stockedAt =
    firstDay && firstDay.slice(0, 7) === parsed.stockedMonthKey
      ? firstDay
      : `${parsed.stockedMonthKey}-01`;

  return {
    stockedAt,
    logs,
    samplings,
    newFeedTypes,
    months,
    totals,
    findings: sortFindings(findings),
  };
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

function sortFindings(findings: Finding[]) {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.finding.severity] - SEVERITY_ORDER[b.finding.severity] ||
        (a.finding.monthKey ?? "").localeCompare(b.finding.monthKey ?? "") ||
        a.index - b.index,
    )
    .map(({ finding }) => finding);
}

function mode(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function sum<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((total, item) => total + pick(item), 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
