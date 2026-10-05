import { addDays, addMonths, addMonthsToDay, dateToDayKey, daysBetween } from "./dates";

// Growth stages across one culture cycle, as equal quarters of the planned
// length (month 0–2, 2–4, 4–6, 6–8 for the usual 8-month cycle), then
// "ready" once the planned harvest date is reached.
// Labels are translated as "stage.<key>".
export const STAGES = [
  { key: "nursery", color: "var(--stage-1)" },
  { key: "juvenile", color: "var(--stage-2)" },
  { key: "growout", color: "var(--stage-3)" },
  { key: "finishing", color: "var(--stage-4)" },
  { key: "ready", color: "var(--stage-5)" },
] as const;

export type Stage = (typeof STAGES)[number];
export type StageKey = Stage["key"];

const GROWING_STAGES = STAGES.length - 1;

export type CycleStatus =
  | {
      state: "growing" | "ready";
      stockedAt: string;
      plannedHarvestAt: string;
      day: number;
      totalDays: number;
      progress: number;
      // Negative once the planned harvest date has passed.
      daysToHarvest: number;
      stage: Stage;
      stageIndex: number;
    }
  // Harvested or lost, and not yet restocked.
  | { state: "empty"; since: string; lastOutcome: "harvested" | "lost" }
  // Never given a stocking date.
  | { state: "unset" };

type CyclePond = { stockedAt: Date | null; cycleMonths: number };
type LastCycle = { endedAt: Date; outcome: string } | null | undefined;

export function plannedHarvestDate(stockedAt: string, cycleMonths: number) {
  return addMonthsToDay(stockedAt, cycleMonths);
}

export function getCycleStatus(pond: CyclePond, lastCycle: LastCycle, today: string): CycleStatus {
  if (!pond.stockedAt) {
    if (!lastCycle) return { state: "unset" };
    return {
      state: "empty",
      since: dateToDayKey(lastCycle.endedAt),
      lastOutcome: lastCycle.outcome === "lost" ? "lost" : "harvested",
    };
  }

  const stockedAt = dateToDayKey(pond.stockedAt);
  const plannedHarvestAt = plannedHarvestDate(stockedAt, pond.cycleMonths);
  const totalDays = Math.max(daysBetween(stockedAt, plannedHarvestAt), 1);
  const day = Math.max(daysBetween(stockedAt, today), 0);
  const progress = day / totalDays;
  const stageIndex = progress >= 1 ? GROWING_STAGES : Math.min(Math.floor(progress * GROWING_STAGES), GROWING_STAGES - 1);

  return {
    state: progress >= 1 ? "ready" : "growing",
    stockedAt,
    plannedHarvestAt,
    day,
    totalDays,
    progress,
    daysToHarvest: daysBetween(today, plannedHarvestAt),
    stage: STAGES[stageIndex],
    stageIndex,
  };
}

// Calendar span of each growing stage for a cycle, as [from, to) day keys.
export function stageSpans(stockedAt: string, plannedHarvestAt: string) {
  const total = daysBetween(stockedAt, plannedHarvestAt);
  return STAGES.slice(0, GROWING_STAGES).map((stage, index) => ({
    stage,
    from: addDays(stockedAt, Math.round((total * index) / GROWING_STAGES)),
    to: addDays(stockedAt, Math.round((total * (index + 1)) / GROWING_STAGES)),
  }));
}

// Culture months a stage spans (0–2 for the first of an 8-month cycle);
// "to" is null for the ready stage, which runs on from the planned end.
export function stageMonthRange(stageIndex: number, cycleMonths: number) {
  if (stageIndex >= GROWING_STAGES) return { from: cycleMonths, to: null };
  const round = (value: number) => Number(value.toFixed(1));
  return {
    from: round((cycleMonths * stageIndex) / GROWING_STAGES),
    to: round((cycleMonths * (stageIndex + 1)) / GROWING_STAGES),
  };
}

// The first day that belongs to the running cycle, so logs from earlier
// cycles stay out of this cycle's totals. Null means "use every record".
export function currentCycleStart(pond: { stockedAt: Date | null }, lastCycle: LastCycle): string | null {
  if (pond.stockedAt) return dateToDayKey(pond.stockedAt);
  return lastCycle ? addDays(dateToDayKey(lastCycle.endedAt), 1) : null;
}

export type ForecastMonth = {
  monthKey: string;
  ponds: { id: number; name: string; plannedHarvestAt: string }[];
};

// Planned harvests per month from this month on. Ponds already past their
// planned date count toward this month, since they are ready now.
export function harvestForecast(
  entries: { pond: { id: number; name: string }; cycle: CycleStatus }[],
  today: string,
  months = 12,
): ForecastMonth[] {
  const thisMonth = today.slice(0, 7);
  const forecast: ForecastMonth[] = Array.from({ length: months }, (_, index) => ({
    monthKey: addMonths(thisMonth, index),
    ponds: [],
  }));
  for (const { pond, cycle } of entries) {
    if (cycle.state !== "growing" && cycle.state !== "ready") continue;
    const monthKey = cycle.plannedHarvestAt.slice(0, 7) < thisMonth ? thisMonth : cycle.plannedHarvestAt.slice(0, 7);
    forecast
      .find((month) => month.monthKey === monthKey)
      ?.ponds.push({ id: pond.id, name: pond.name, plannedHarvestAt: cycle.plannedHarvestAt });
  }
  return forecast;
}

// Months with no planned harvest, counted only up to the furthest month
// any running cycle reaches (beyond that nothing is stocked yet anyway).
export function supplyGaps(forecast: ForecastMonth[]) {
  const lastPlanned = forecast.findLastIndex((month) => month.ponds.length > 0);
  if (lastPlanned < 0) return [];
  return forecast.slice(0, lastPlanned + 1).filter((month) => month.ponds.length === 0);
}

// For an empty pond: the stocking month in the next three whose harvest lands
// in the month with the fewest other harvests, to keep supply even.
export function suggestStocking(
  entries: { pond: { id: number; name: string }; cycle: CycleStatus }[],
  cycleMonths: number,
  today: string,
) {
  const forecast = harvestForecast(entries, today, cycleMonths + 4);
  const thisMonth = today.slice(0, 7);
  const options = [0, 1, 2].map((offset) => {
    const stockMonth = addMonths(thisMonth, offset);
    const harvestMonth = addMonths(stockMonth, cycleMonths);
    const others = forecast.find((month) => month.monthKey === harvestMonth)?.ponds ?? [];
    return { stockMonth, harvestMonth, others };
  });
  return options.reduce((best, option) => (option.others.length < best.others.length ? option : best));
}

// Feed conversion ratio (kg feed per kg fish) against the pond's target FCR.
// Up to 15% over target is worth watching; beyond that feed is being wasted.
export type FcrRating = "good" | "watch" | "high";

export function fcrRating(fcr: number, target: number): FcrRating {
  if (fcr <= target) return "good";
  return fcr <= target * 1.15 ? "watch" : "high";
}
