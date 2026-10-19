"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { addDays, addMonths, dateToDayKey, daysBetween } from "@fisheye/shared/dates";
import { STAGES, fcrRating, stageMonthRange, stageSpans, supplyGaps, type CycleStatus, type ForecastMonth } from "@fisheye/shared/cycle";
import type { T } from "@fisheye/shared/i18n/translate";
import { CheckIcon, HarvestIcon, XIcon } from "./icons";
import { cx } from "./ui";
import { useI18n } from "@/app/components/I18nProvider";

export function stageLabel(t: T, key: (typeof STAGES)[number]["key"]) {
  return t(`stage.${key}`);
}

export function StageBadge({ cycle, className }: { cycle: CycleStatus; className?: string }) {
  const { t } = useI18n();
  if (cycle.state === "unset") {
    return <span className={cx("text-xs text-ink-3", className)}>{t("cycle.stockingNotSet")}</span>;
  }
  if (cycle.state === "empty") {
    const lost = cycle.lastOutcome === "lost";
    return (
      <span
        className={cx(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
          lost ? "bg-danger-soft text-danger" : "bg-surface-3 text-ink-2",
          className,
        )}
      >
        {lost ? <XIcon className="size-3" strokeWidth={2.4} /> : <CheckIcon className="size-3" strokeWidth={2.4} />}
        {lost ? t("cycle.emptyLost") : t("cycle.emptyHarvested")}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink",
        className,
      )}
    >
      <span className="size-2 rounded-full" style={{ background: cycle.stage.color }} aria-hidden="true" />
      {stageLabel(t, cycle.stage.key)}
    </span>
  );
}

const fcrToneClass = { good: "text-positive", watch: "text-warning", high: "text-danger" } as const;

// FCR coloured against the pond's target: green at or under, amber up to
// 15% over, red beyond.
export function FcrValue({ fcr, target, className }: { fcr: number | null; target: number; className?: string }) {
  const { t } = useI18n();
  if (fcr === null || !Number.isFinite(fcr)) {
    return (
      <span className={cx("text-ink-3", className)} title={t("fcr.needs")}>
        —
      </span>
    );
  }
  return (
    <span
      className={cx("tabular-nums font-medium", fcrToneClass[fcrRating(fcr, target)], className)}
      title={t("fcr.targetValue", { target })}
    >
      {fcr.toFixed(2)}
    </span>
  );
}

// "Harvest in 40 days", "Ready · 12 days past plan", "Empty 9 days".
export function harvestLabel(cycle: CycleStatus, today: string, t: T) {
  if (cycle.state === "unset") return t("cycle.setStocking");
  if (cycle.state === "empty") {
    const days = daysBetween(cycle.since, today);
    return days === 0 ? t("cycle.emptiedToday") : t("cycle.emptyDays", { n: days });
  }
  const days = cycle.daysToHarvest;
  if (days > 0) return t("cycle.harvestIn", { n: days });
  if (days === 0) return t("cycle.harvestToday");
  return t("cycle.readyPast", { n: -days });
}

export function CycleProgress({ cycle, today }: { cycle: CycleStatus; today: string }) {
  const { t } = useI18n();
  if (cycle.state !== "growing" && cycle.state !== "ready") {
    return <p className="mt-1 text-xs text-ink-3">{harvestLabel(cycle, today, t)}</p>;
  }
  const soon = cycle.state === "growing" && cycle.daysToHarvest <= 30;
  return (
    <div className="mt-1.5 w-52">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div
          className="grow-x h-full rounded-full"
          style={{
            width: `${Math.min(cycle.progress, 1) * 100}%`,
            background: cycle.stage.color,
          }}
        />
      </div>
      <p
        className={cx(
          "mt-1 text-xs tabular-nums",
          cycle.state === "ready" ? "font-medium text-danger" : soon ? "font-medium text-warning" : "text-ink-3",
        )}
      >
        {t("cycle.dayOf", { day: cycle.day, total: cycle.totalDays })} · {harvestLabel(cycle, today, t)}
      </p>
    </div>
  );
}

// Stage-by-stage progress for one pond, shown at the top of the pond page.
export function CycleStepper({
  cycle,
  cycleMonths,
  today,
  fcr,
  targetFcr,
  action,
}: {
  cycle: CycleStatus;
  cycleMonths: number;
  today: string;
  fcr: number | null;
  targetFcr: number;
  action?: ReactNode;
}) {
  const { t, fmt } = useI18n();
  if (cycle.state !== "growing" && cycle.state !== "ready") return null;
  const spans = stageSpans(cycle.stockedAt, cycle.plannedHarvestAt);
  return (
    <div className="mb-6 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {stageLabel(t, cycle.stage.key)}
            <span className="font-normal text-ink-3"> · {t("cycle.dayOfLong", { day: cycle.day, total: cycle.totalDays })}</span>
          </p>
          <p className={cx("text-sm", cycle.state === "ready" ? "text-danger" : "text-ink-2")}>
            {harvestLabel(cycle, today, t)} · {t("cycle.planned", { date: fmt.dayKey(cycle.plannedHarvestAt) })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="sm:text-right">
            <p className="text-xs text-ink-3">{t("fcr.soFar")}</p>
            <p className="text-sm">
              <FcrValue fcr={fcr} target={targetFcr} />
              <span className="text-xs text-ink-3"> / {t("fcr.target", { target: targetFcr })}</span>
            </p>
          </div>
          {action}
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)] gap-1.5" aria-label={t("cycle.stages")}>
        {STAGES.map((stage, index) => {
          const done = index < cycle.stageIndex;
          const current = index === cycle.stageIndex;
          const range = stageMonthRange(index, cycleMonths);
          const span = spans[index];
          const harvest = stage.key === "ready";
          return (
            <li key={stage.key} aria-current={current ? "step" : undefined}>
              {harvest ? (
                // The harvest step is the finish line: always red (faded until
                // reached) with a basket badge at the end.
                <div className="relative h-4">
                  <div
                    className="h-full rounded-full"
                    style={{ background: "var(--stage-5)", opacity: current ? 1 : 0.35 }}
                  />
                  <span
                    className={cx(
                      "absolute top-1/2 right-0 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-white ring-2 ring-surface",
                      !current && "opacity-60",
                    )}
                    style={{ background: "var(--stage-5)" }}
                    aria-hidden="true"
                  >
                    <HarvestIcon className="size-4" strokeWidth={2.2} />
                  </span>
                </div>
              ) : (
                <div
                  className={cx("h-4 rounded-full", !done && !current && "bg-surface-3", current && "ring-2 ring-offset-2 ring-offset-surface")}
                  style={
                    done || current
                      ? { background: stage.color, opacity: done ? 0.7 : 1, ...(current ? { ["--tw-ring-color" as string]: stage.color } : {}) }
                      : undefined
                  }
                />
              )}
              <p
                className={cx("mt-2 text-xs", harvest ? "leading-tight" : "truncate", current || harvest ? "font-semibold" : "text-ink-3")}
                style={current || harvest ? { color: stage.color } : undefined}
              >
                {stageLabel(t, stage.key)}
              </p>
              <p
                className="hidden text-[11px] text-ink-3 sm:block"
                title={
                  range.to === null
                    ? t("cycle.monthFrom", { from: range.from })
                    : t("cycle.monthRange", { from: range.from, to: range.to })
                }
              >
                {span
                  ? t("cycle.dateRange", { from: fmt.month(span.from.slice(0, 7)), to: fmt.month(addDays(span.to, -1).slice(0, 7)) })
                  : t("cycle.dateFrom", { from: fmt.month(cycle.plannedHarvestAt.slice(0, 7)) })}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type BoardEntry = {
  pond: { id: number; name: string };
  cycle: CycleStatus;
  lastCycle: { stockedAt: Date; endedAt: Date; outcome: string } | null;
};

const MONTHS_BEFORE = 4;
const MONTHS_SHOWN = 14;

// Timeline of every pond's cycle: past months solid, the months ahead faded,
// so staggered harvests and gaps in supply are visible at a glance.
export function CycleBoard({ entries, forecast, today }: { entries: BoardEntry[]; forecast: ForecastMonth[]; today: string }) {
  const { t, fmt } = useI18n();
  const firstMonth = addMonths(today.slice(0, 7), -MONTHS_BEFORE);
  const windowStart = `${firstMonth}-01`;
  const windowEnd = `${addMonths(firstMonth, MONTHS_SHOWN)}-01`;
  const span = daysBetween(windowStart, windowEnd);
  const pct = (day: string) => Math.min(Math.max(daysBetween(windowStart, day) / span, 0), 1) * 100;
  const months = Array.from({ length: MONTHS_SHOWN }, (_, index) => addMonths(firstMonth, index));
  const todayPct = pct(today);

  const bar = (from: string, to: string, style: CSSProperties, title: string, key: string) => {
    if (to <= windowStart || from >= windowEnd) return null;
    const left = pct(from);
    const width = pct(to) - left;
    if (width <= 0) return null;
    return <span key={key} title={title} className="absolute inset-y-1" style={{ left: `${left}%`, width: `${width}%`, ...style }} />;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] px-5 pb-2">
        <div className="grid grid-cols-[132px_minmax(0,1fr)_148px] items-end gap-3 pb-1.5">
          <span />
          <div className="relative h-5 text-[11px] text-ink-3">
            {months.map((monthKey) => (
              <span key={monthKey} className="absolute top-0 -translate-x-0" style={{ left: `${pct(`${monthKey}-01`)}%` }}>
                <span className="pl-1">{fmt.month(monthKey)}</span>
              </span>
            ))}
          </div>
          <span className="text-right text-[11px] text-ink-3">{t("board.harvest")}</span>
        </div>

        <ul className="divide-y divide-line border-y border-line">
          {entries.map(({ pond, cycle, lastCycle }) => {
            const segments: ReactNode[] = [];
            const lastEnd = lastCycle ? dateToDayKey(lastCycle.endedAt) : null;

            if (lastCycle && lastEnd) {
              const lost = lastCycle.outcome === "lost";
              segments.push(
                bar(
                  dateToDayKey(lastCycle.stockedAt),
                  lastEnd,
                  { background: "var(--line-strong)", borderRadius: 4, opacity: 0.7 },
                  t(lost ? "board.previousLost" : "board.previousHarvested", { date: fmt.day(lastCycle.endedAt) }),
                  "last",
                ),
              );
              if (lastEnd > windowStart && lastEnd < windowEnd) {
                segments.push(
                  <span
                    key="last-end"
                    title={t(lost ? "board.stockLostOn" : "board.harvestedOn", { date: fmt.day(lastCycle.endedAt) })}
                    className={cx(
                      "absolute top-1/2 z-10 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white ring-2 ring-surface",
                      lost ? "bg-danger" : "bg-positive",
                    )}
                    style={{ left: `${pct(lastEnd)}%` }}
                  >
                    {lost ? <XIcon className="size-2.5" strokeWidth={3} /> : <CheckIcon className="size-2.5" strokeWidth={3} />}
                  </span>,
                );
              }
            }

            if (cycle.state === "empty") {
              segments.push(
                bar(
                  cycle.since,
                  today,
                  { border: "1.5px dashed var(--line-strong)", borderRadius: 4 },
                  t("board.emptySince", { date: fmt.dayKey(cycle.since) }),
                  "empty",
                ),
              );
            }

            if (cycle.state === "growing" || cycle.state === "ready") {
              stageSpans(cycle.stockedAt, cycle.plannedHarvestAt).forEach(({ stage, from, to }, index) => {
                const title = `${stageLabel(t, stage.key)} · ${fmt.dayKey(from, { year: false })} – ${fmt.dayKey(to, { year: false })}`;
                const radius = {
                  borderTopLeftRadius: index === 0 ? 4 : 0,
                  borderBottomLeftRadius: index === 0 ? 4 : 0,
                  borderTopRightRadius: index === 3 ? 4 : 0,
                  borderBottomRightRadius: index === 3 ? 4 : 0,
                };
                const pastEnd = to < today ? to : today;
                if (from < today) segments.push(bar(from, pastEnd, { background: stage.color, ...radius }, title, `${stage.key}-past`));
                if (to > today) {
                  const futureFrom = from > today ? from : today;
                  segments.push(bar(futureFrom, to, { background: stage.color, opacity: 0.35, ...radius }, title, `${stage.key}-future`));
                }
              });
              if (cycle.state === "ready") {
                segments.push(
                  bar(
                    cycle.plannedHarvestAt,
                    today,
                    {
                      background: "repeating-linear-gradient(135deg, var(--stage-5) 0 5px, color-mix(in srgb, var(--stage-5) 25%, transparent) 5px 9px)",
                      borderRadius: 4,
                    },
                    t("board.pastPlanned"),
                    "overdue",
                  ),
                );
              }
              if (cycle.plannedHarvestAt > windowStart && cycle.plannedHarvestAt < windowEnd) {
                segments.push(
                  <span
                    key="harvest"
                    title={t("board.plannedHarvestOn", { date: fmt.dayKey(cycle.plannedHarvestAt) })}
                    className={cx(
                      "absolute top-1/2 z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white ring-2 ring-surface",
                    )}
                    style={{ left: `${pct(cycle.plannedHarvestAt)}%`, background: "var(--stage-5)" }}
                  >
                    <HarvestIcon className="size-3.5" strokeWidth={2.4} />
                  </span>,
                );
              }
            }

            const ready = cycle.state === "ready";
            const soon = cycle.state === "growing" && cycle.daysToHarvest <= 30;
            return (
              <li key={pond.id} className="grid grid-cols-[132px_minmax(0,1fr)_148px] items-center gap-3 py-2">
                <div className="min-w-0">
                  <Link href={`/ponds/${pond.id}?view=cycle`} className="block truncate text-sm font-semibold text-ink hover:text-brand">
                    {pond.name}
                  </Link>
                  <StageBadge cycle={cycle} className="mt-0.5 px-0! bg-transparent!" />
                </div>
                <div className="relative h-11">
                  {months.map((monthKey) => (
                    <span
                      key={monthKey}
                      className="absolute inset-y-0 border-l border-line"
                      style={{ left: `${pct(`${monthKey}-01`)}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  {segments}
                  <span className="absolute inset-y-0 z-20 border-l-2 border-brand" style={{ left: `${todayPct}%` }} aria-hidden="true" />
                  <span className="sr-only">
                    {cycle.state === "growing" || cycle.state === "ready"
                      ? t("board.srRunning", {
                          pond: pond.name,
                          stage: stageLabel(t, cycle.stage.key),
                          day: cycle.day,
                          total: cycle.totalDays,
                          date: fmt.dayKey(cycle.plannedHarvestAt),
                        })
                      : `${pond.name}: ${harvestLabel(cycle, today, t)}.`}
                  </span>
                </div>
                <div className="text-right">
                  {cycle.state === "growing" || cycle.state === "ready" ? (
                    <>
                      <p className={cx("text-sm font-medium tabular-nums", ready ? "text-danger" : soon ? "text-warning" : "text-ink")}>
                        {fmt.dayKey(cycle.plannedHarvestAt, { year: false })}{" "}
                        <span className="text-xs font-normal text-ink-3">{cycle.plannedHarvestAt.slice(2, 4)}</span>
                      </p>
                      <p className="text-xs text-ink-3">
                        {ready ? t("board.daysPast", { n: -cycle.daysToHarvest }) : t("board.inDays", { n: cycle.daysToHarvest })}
                      </p>
                    </>
                  ) : (
                    <Link href={`/ponds/${pond.id}?view=cycle`} className="text-xs font-medium text-brand hover:underline">
                      {cycle.state === "empty" ? t("board.restock") : t("cycle.setStocking")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 grid grid-cols-[132px_minmax(0,1fr)_148px] gap-3 text-[11px] text-ink-3">
          <span />
          <div className="relative h-4">
            <span className="absolute -translate-x-1/2 font-semibold text-brand" style={{ left: `${todayPct}%` }}>
              {t("board.today")}
            </span>
          </div>
        </div>

        <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {STAGES.map((stage) => (
            <li key={stage.key} className="inline-flex items-center gap-1.5">
              <span
                className="size-3 rounded-[3px]"
                style={{ background: stage.color }}
              />
              {stageLabel(t, stage.key)}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span className="flex size-4 items-center justify-center rounded-full text-white" style={{ background: "var(--stage-5)" }}>
              <HarvestIcon className="size-2.5" strokeWidth={2.6} />
            </span>
            {t("board.plannedHarvest")}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="flex size-3.5 items-center justify-center rounded-full bg-danger text-white">
              <XIcon className="size-2" strokeWidth={3} />
            </span>
            {t("board.stockLost")}
          </li>
        </ul>
      </div>

      <HarvestCalendar forecast={forecast} />
    </div>
  );
}

// Twelve months ahead, with the ponds planned to harvest in each. Months
// with nothing planned (before the last planned harvest) are supply gaps.
function HarvestCalendar({ forecast }: { forecast: ForecastMonth[] }) {
  const { t, fmt } = useI18n();
  const gaps = new Set(supplyGaps(forecast).map((month) => month.monthKey));
  const lastPlanned = forecast.findLastIndex((month) => month.ponds.length > 0);
  return (
    <div className="mt-4 min-w-[760px] border-t border-line px-5 pt-4 pb-5">
      <h3 className="text-sm font-semibold text-ink">{t("calendar.title")}</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        {t("calendar.description")}{" "}
        {gaps.size > 0
          ? t("calendar.gaps", { n: gaps.size })
          : lastPlanned >= 0
            ? t("calendar.noGaps")
            : t("calendar.noneStocked")}
      </p>
      <ol className="mt-3 grid grid-cols-12 gap-1.5">
        {forecast.map((month, index) => {
          const gap = gaps.has(month.monthKey);
          const beyond = index > lastPlanned;
          return (
            <li
              key={month.monthKey}
              className={cx(
                "min-h-20 rounded-lg border p-2",
                gap ? "border-warning/40 bg-warning-soft" : month.ponds.length > 0 ? "border-line bg-surface-2" : "border-dashed border-line",
              )}
            >
              <p className={cx("text-[11px] font-medium", gap ? "text-warning" : "text-ink-3")}>
                {fmt.monthName(month.monthKey)}
                <span className="font-normal"> {month.monthKey.slice(2, 4)}</span>
              </p>
              {month.ponds.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {month.ponds.map((pond) => (
                    <li key={pond.id} className="truncate text-xs font-medium text-ink">
                      {pond.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cx("mt-1 text-xs", gap ? "font-medium text-warning" : "text-ink-3")}>
                  {gap ? t("calendar.noHarvest") : beyond ? "—" : ""}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
