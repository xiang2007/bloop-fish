// Calendar-day helpers. A "day key" is a YYYY-MM-DD string in the farm's
// local timezone; in the database a day is stored as UTC midnight of that
// key, and every formatter below reads it back in UTC.

export const FARM_TIME_ZONE = "Asia/Kuala_Lumpur";

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return dateToDayKey(dayKeyToDate(value)) === value;
}

export function todayKey(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return now.toLocaleDateString("en-CA", { timeZone: FARM_TIME_ZONE });
}

export function addDays(key: string, days: number): string {
  return dateToDayKey(new Date(dayKeyToDate(key).getTime() + days * DAY_MS));
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (dayKeyToDate(toKey).getTime() - dayKeyToDate(fromKey).getTime()) / DAY_MS,
  );
}

// "YYYY-MM"
export function monthKeyOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function monthStart(monthKey: string): Date {
  return dayKeyToDate(`${monthKey}-01`);
}

export function addMonths(monthKey: string, months: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Same day of the month, clamped to the month's last day (31 Jan + 1 → 28 Feb).
export function addMonthsToDay(key: string, months: number): string {
  const monthKey = addMonths(key.slice(0, 7), months);
  const day = Math.min(Number(key.slice(8, 10)), daysInMonth(monthKey));
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function monthsBetween(fromMonthKey: string, toMonthKey: string): number {
  const [fy, fm] = fromMonthKey.split("-").map(Number);
  const [ty, tm] = toMonthKey.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function lastDayOfMonth(monthKey: string): Date {
  return dayKeyToDate(`${monthKey}-${String(daysInMonth(monthKey)).padStart(2, "0")}`);
}

export function formatDay(date: Date, options?: { weekday?: boolean; year?: boolean; tag?: string }) {
  return date.toLocaleDateString(options?.tag ?? "en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(options?.year === false ? {} : { year: "numeric" }),
    ...(options?.weekday ? { weekday: "short" } : {}),
  });
}

export function formatMonth(monthKey: string, style: "short" | "long" = "short", tag = "en-GB") {
  return monthStart(monthKey).toLocaleDateString(tag, {
    timeZone: "UTC",
    month: style,
    year: style === "short" ? "2-digit" : "numeric",
  });
}

export function relativeDays(fromKey: string, toKey: string): string {
  const days = daysBetween(fromKey, toKey);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 0) return `in ${-days} days`;
  return `${days} days ago`;
}
