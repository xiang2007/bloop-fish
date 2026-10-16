import { dateToDayKey, daysBetween } from "./dates";

export const DEFAULT_BOX_KG = 500;

export type HarvestLineRecord = {
  kg: number;
  fishCount: number | null;
  grade: { id: number; label: string; sortOrder: number };
};

export type HarvestRecord = {
  id: number;
  date: Date;
  totalKg: number;
  boxes: number | null;
  fishCount: number | null;
  isFinal: boolean;
  note: string | null;
  lines: HarvestLineRecord[];
};

// Day of culture a harvest happened on ("day 1" is the stocking day + 1).
export function cultureDay(stockedAt: Date | string, date: Date | string) {
  const from = typeof stockedAt === "string" ? stockedAt : dateToDayKey(stockedAt);
  const to = typeof date === "string" ? date : dateToDayKey(date);
  return Math.max(daysBetween(from, to), 0);
}

// Boxes needed for a weight, rounded up: a part-filled box is still a box.
export function estimateBoxes(kg: number, boxKg: number) {
  if (!(kg > 0) || !(boxKg > 0)) return 0;
  return Math.ceil(kg / boxKg);
}

export type GradeShare = { id: number; label: string; sortOrder: number; kg: number; fishCount: number | null; share: number };

// Weight per size grade across one or more harvests, largest grade last.
export function gradeMix(lines: HarvestLineRecord[]): GradeShare[] {
  const byGrade = new Map<number, GradeShare>();
  for (const line of lines) {
    const entry = byGrade.get(line.grade.id) ?? { ...line.grade, kg: 0, fishCount: null, share: 0 };
    entry.kg += line.kg;
    if (line.fishCount !== null) entry.fishCount = (entry.fishCount ?? 0) + line.fishCount;
    byGrade.set(line.grade.id, entry);
  }
  const total = [...byGrade.values()].reduce((sum, entry) => sum + entry.kg, 0);
  return [...byGrade.values()]
    .map((entry) => ({ ...entry, share: total > 0 ? entry.kg / total : 0 }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function topGrade(mix: GradeShare[]) {
  return mix.reduce<GradeShare | null>((best, entry) => (best === null || entry.kg > best.kg ? entry : best), null);
}

export function harvestTotals(harvests: { totalKg: number; fishCount: number | null }[]) {
  return harvests.reduce(
    (sum, harvest) => ({
      count: sum.count + 1,
      kg: sum.kg + harvest.totalKg,
      fish: sum.fish + (harvest.fishCount ?? 0),
      // Harvests without a count can't be averaged by weight.
      countedKg: sum.countedKg + (harvest.fishCount ? harvest.totalKg : 0),
    }),
    { count: 0, kg: 0, fish: 0, countedKg: 0 },
  );
}

// Average fish weight in a harvest, when the fish were counted.
export function averageFishKg(harvest: { totalKg: number; fishCount: number | null }) {
  return harvest.fishCount ? harvest.totalKg / harvest.fishCount : null;
}
