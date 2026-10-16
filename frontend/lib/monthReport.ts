import { addMonths, dateToDayKey, daysInMonth, monthKeyOf } from "@fisheye/shared/dates";
import type { MonthRow } from "@fisheye/shared/metrics";
import type { PondWithMetrics } from "@backend/lib/queries";

export type MonthSummary = {
  monthKey: string;
  // Calendar days in scope: the whole month, or up to today for the current month.
  daysInScope: number;
  // Pond-days with a record.
  daysLogged: number;
  expectedDays: number;
  bags: number;
  feedKg: number;
  feedCostRm: number;
  deadCount: number;
  deadKg: number;
  avgDailyFeedKg: number;
  avgPricePerKg: number | null;
  estimatedStockKg: number;
  avgWeightKg: number | null;
};

export type MonthReport = {
  current: MonthSummary;
  previous: MonthSummary | null;
  isPartial: boolean;
  daily: {
    day: number;
    dayKey: string;
    byType: { feedTypeId: number | null; code: string; feedKg: number; bags: number }[];
    deadCount: number;
    logged: number;
  }[];
  feedTypes: { feedTypeId: number | null; code: string; bags: number; feedKg: number; feedCostRm: number }[];
  packSizes: { packSizeKg: number; bags: number; feedKg: number }[];
  ponds: { id: number; name: string; row: MonthRow | null; previous: MonthRow | null }[];
  notes: { dayKey: string; pondName: string; note: string; recordedBy: string | null }[];
};

// Months that have any record in the given ponds, plus the current month.
export function availableMonths(ponds: PondWithMetrics[], today: string) {
  const keys = new Set(ponds.flatMap(({ metrics }) => metrics.months.map((month) => month.monthKey)));
  keys.add(today.slice(0, 7));
  return [...keys].sort();
}

function summarise(ponds: PondWithMetrics[], monthKey: string, today: string): MonthSummary | null {
  const rows = ponds
    .map(({ metrics }) => metrics.months.find((month) => month.monthKey === monthKey))
    .filter((row): row is MonthRow => Boolean(row));
  if (rows.length === 0) return null;

  const isCurrent = monthKey === today.slice(0, 7);
  const daysInScope = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(monthKey);
  const feedKg = rows.reduce((sum, row) => sum + row.feedKg, 0);
  const feedCostRm = rows.reduce((sum, row) => sum + row.feedCostRm, 0);
  const daysLogged = rows.reduce((sum, row) => sum + row.daysLogged, 0);
  // Only ponds already stocked (with records by this month) are expected to log.
  const activePonds = ponds.filter(({ metrics }) => metrics.firstLogDate && metrics.firstLogDate.slice(0, 7) <= monthKey).length;
  const weights = rows.map((row) => row.avgWeightKg).filter((value): value is number => value !== null);

  return {
    monthKey,
    daysInScope,
    daysLogged,
    expectedDays: Math.max(activePonds, rows.length) * daysInScope,
    bags: rows.reduce((sum, row) => sum + row.bags, 0),
    feedKg,
    feedCostRm,
    deadCount: rows.reduce((sum, row) => sum + row.deadCount, 0),
    deadKg: rows.reduce((sum, row) => sum + row.deadKg, 0),
    avgDailyFeedKg: daysLogged > 0 ? feedKg / (daysLogged / rows.length) : 0,
    avgPricePerKg: feedKg > 0 ? feedCostRm / feedKg : null,
    estimatedStockKg: rows.reduce((sum, row) => sum + row.estimatedBiomassKg, 0),
    // Average weight is only meaningful for a single pond.
    avgWeightKg: rows.length === 1 && weights.length === 1 ? weights[0] : null,
  };
}

export function buildMonthReport(ponds: PondWithMetrics[], monthKey: string, today: string): MonthReport | null {
  const current = summarise(ponds, monthKey, today);
  if (!current) return null;
  const previous = summarise(ponds, addMonths(monthKey, -1), today);

  const monthLogs = ponds.flatMap(({ pond, logs }) =>
    logs.filter((log) => monthKeyOf(log.date) === monthKey).map((log) => ({ log, pondName: pond.name })),
  );

  const daily = Array.from({ length: current.daysInScope }, (_, index) => {
    const dayKey = `${monthKey}-${String(index + 1).padStart(2, "0")}`;
    const entries = monthLogs.filter(({ log }) => dateToDayKey(log.date) === dayKey);
    const byType = new Map<string, { feedTypeId: number | null; code: string; feedKg: number; bags: number }>();
    for (const { log } of entries) {
      if (log.bags <= 0 || !log.feedType) continue;
      const entry = byType.get(log.feedType.code) ?? { feedTypeId: log.feedTypeId, code: log.feedType.code, feedKg: 0, bags: 0 };
      entry.feedKg += log.feedKg;
      entry.bags += log.bags;
      byType.set(log.feedType.code, entry);
    }
    return {
      day: index + 1,
      dayKey,
      byType: [...byType.values()],
      deadCount: entries.reduce((sum, { log }) => sum + log.deadCount, 0),
      logged: entries.length,
    };
  });

  const typeMap = new Map<string, MonthReport["feedTypes"][number]>();
  const packMap = new Map<number, MonthReport["packSizes"][number]>();
  for (const { log } of monthLogs) {
    if (log.bags <= 0 || !log.feedType) continue;
    const type = typeMap.get(log.feedType.code) ?? {
      feedTypeId: log.feedTypeId,
      code: log.feedType.code,
      bags: 0,
      feedKg: 0,
      feedCostRm: 0,
    };
    type.bags += log.bags;
    type.feedKg += log.feedKg;
    type.feedCostRm += log.feedCostRm;
    typeMap.set(log.feedType.code, type);

    // Pack size as recorded on the log, like the sheet's "Feed Consumed" table.
    const packSizeKg = Math.round((log.feedKg / log.bags) * 100) / 100;
    const pack = packMap.get(packSizeKg) ?? { packSizeKg, bags: 0, feedKg: 0 };
    pack.bags += log.bags;
    pack.feedKg += log.feedKg;
    packMap.set(packSizeKg, pack);
  }

  const previousKey = addMonths(monthKey, -1);
  return {
    current,
    previous,
    isPartial: monthKey === today.slice(0, 7),
    daily,
    feedTypes: [...typeMap.values()].sort((a, b) => b.feedKg - a.feedKg),
    packSizes: [...packMap.values()].sort((a, b) => b.packSizeKg - a.packSizeKg),
    ponds: ponds.map(({ pond, metrics }) => ({
      id: pond.id,
      name: pond.name,
      row: metrics.months.find((month) => month.monthKey === monthKey) ?? null,
      previous: metrics.months.find((month) => month.monthKey === previousKey) ?? null,
    })),
    notes: monthLogs
      .filter(({ log }) => log.note)
      .map(({ log, pondName }) => ({
        dayKey: dateToDayKey(log.date),
        pondName,
        note: log.note as string,
        recordedBy: log.recordedBy,
      }))
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
  };
}
