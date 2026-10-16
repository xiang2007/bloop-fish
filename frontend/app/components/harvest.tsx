"use client";

import Link from "next/link";
import type { CycleStatus } from "@fisheye/shared/cycle";
import type { GradeShare } from "@fisheye/shared/harvest";
import type { Harvestability, HealthLevel, HarvestTiming } from "@fisheye/shared/health";
import { formatNumber, formatPercent } from "@fisheye/shared/format";
import { cx } from "./ui";
import { useI18n } from "@/app/components/I18nProvider";

export const HARVESTABILITY: Record<Harvestability, { color: string; soft: string }> = {
  ready: { color: "var(--stage-5)", soft: "var(--harvest-soft)" },
  soon: { color: "var(--stage-4)", soft: "var(--warning-soft)" },
  harvesting: { color: "var(--brand)", soft: "var(--brand-soft)" },
  growing: { color: "var(--stage-3)", soft: "var(--positive-soft)" },
  empty: { color: "var(--line-strong)", soft: "var(--surface-2)" },
  unset: { color: "var(--line-strong)", soft: "var(--surface-2)" },
};

export const HARVESTABILITY_ORDER: Harvestability[] = ["ready", "soon", "harvesting", "growing", "empty", "unset"];

const HEALTH_TONE: Record<HealthLevel, { dot: string; badge: string }> = {
  good: { dot: "bg-positive", badge: "bg-positive-soft text-positive" },
  watch: { dot: "bg-warning", badge: "bg-warning-soft text-warning" },
  risk: { dot: "bg-danger", badge: "bg-danger-soft text-danger" },
};

export function HealthBadge({ level, className }: { level: HealthLevel; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        HEALTH_TONE[level].badge,
        className,
      )}
    >
      <span className={cx("size-2 rounded-full", HEALTH_TONE[level].dot)} aria-hidden="true" />
      {t(`health.level.${level}`)}
    </span>
  );
}

export function healthDotClass(level: HealthLevel) {
  return HEALTH_TONE[level].dot;
}

export function HarvestabilityBadge({ status, className }: { status: Harvestability; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium text-ink",
        className,
      )}
      style={{ background: HARVESTABILITY[status].soft }}
    >
      <span className="size-2 rounded-full" style={{ background: HARVESTABILITY[status].color }} aria-hidden="true" />
      {t(`harvestability.${status}`)}
    </span>
  );
}

// Share of the harvest in each size grade, as one stacked bar and a legend.
export function GradeMixBar({ mix, compact = false }: { mix: GradeShare[]; compact?: boolean }) {
  const { t } = useI18n();
  if (mix.length === 0) return <p className="text-xs text-ink-3">{t("harvest.noGrades")}</p>;
  const top = mix.reduce((best, entry) => (entry.kg > best.kg ? entry : best), mix[0]);
  return (
    <div>
      <div className="grow-x flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        {mix.map((entry) => (
          <span key={entry.id} style={{ width: `${entry.share * 100}%`, background: gradeColor(entry.sortOrder) }} />
        ))}
      </div>
      <ul className={cx("mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs", compact ? "text-ink-3" : "text-ink-2")}>
        {mix.map((entry) => (
          <li key={entry.id} className={cx("inline-flex items-center gap-1", entry.id === top.id && "font-semibold text-ink")}>
            <span className="size-2.5 rounded-[3px]" style={{ background: gradeColor(entry.sortOrder) }} />
            {entry.label} {formatPercent(entry.share, 0)}
            {!compact && <span className="font-normal text-ink-3">· {formatNumber(entry.kg, 0)} kg</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// One clearly different hue per grade, smallest to biggest, so the sizes can
// be told apart at a glance in the bar and legend.
export function gradeColor(sortOrder: number) {
  const palette = ["#38bdf8", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6"];
  return palette[Math.min(Math.max(sortOrder - 1, 0), palette.length - 1)];
}

export type FarmMapPond = {
  pond: { id: number; name: string };
  cycle: CycleStatus;
  harvestability: Harvestability;
  health: { level: HealthLevel } | null;
  timing: HarvestTiming | null;
  estimatedKg: number;
  boxes: number;
};

export type FarmMapGroup = { id: number | null; name: string; ponds: FarmMapPond[] };

// Each farm as a block of squares, one per pond, coloured by how ready it is
// to harvest. The fill shows progress through the cycle; the corner dot is
// pond health.
export function FarmMap({ farms, size = "lg" }: { farms: FarmMapGroup[]; size?: "sm" | "lg" }) {
  const { t, fmt } = useI18n();
  const small = size === "sm";
  return (
    <div className="space-y-5">
      {farms.map((farm) => (
        <div key={farm.id ?? "none"}>
          {farm.name && (
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">{farm.name}</h3>
              <p className="text-xs text-ink-3">
                {HARVESTABILITY_ORDER.filter((status) => farm.ponds.some((entry) => entry.harvestability === status))
                  .map((status) => `${farm.ponds.filter((entry) => entry.harvestability === status).length} ${t(`harvestability.${status}`)}`)
                  .join(" · ")}
              </p>
            </div>
          )}
          {farm.ponds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-3">{t("farmMap.noPonds")}</p>
          ) : (
            <ul
              className={cx(
                "grid gap-2",
                small ? "grid-cols-[repeat(auto-fill,minmax(88px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(150px,1fr))]",
              )}
            >
              {farm.ponds.map((entry) => {
                const style = HARVESTABILITY[entry.harvestability];
                const running = entry.cycle.state === "growing" || entry.cycle.state === "ready";
                const progress = running && entry.cycle.state !== "empty" && entry.cycle.state !== "unset" ? Math.min(entry.cycle.progress, 1) : 0;
                const ready = entry.harvestability === "ready";
                const subtitle =
                  entry.cycle.state === "growing" || entry.cycle.state === "ready"
                    ? entry.timing
                      ? entry.timing.daysLeft > 0
                        ? t("farmMap.harvestIn", { n: entry.timing.daysLeft })
                        : t("farmMap.harvestNow")
                      : t("cycle.dayOf", { day: entry.cycle.day, total: entry.cycle.totalDays })
                    : entry.cycle.state === "empty"
                      ? t("harvestability.empty")
                      : t("harvestability.unset");
                return (
                  <li key={entry.pond.id}>
                    <Link
                      href={`/ponds/${entry.pond.id}`}
                      title={`${entry.pond.name} · ${t(`harvestability.${entry.harvestability}`)}${
                        entry.timing ? ` · ${t("farmMap.harvestBy", { date: fmt.dayKey(entry.timing.harvestBy) })}` : ""
                      }`}
                      className={cx(
                        "relative flex aspect-square flex-col justify-between overflow-hidden rounded-lg border-2 p-2 transition-transform hover:-translate-y-0.5",
                        entry.cycle.state === "empty" || entry.cycle.state === "unset" ? "border-dashed" : "border-solid",
                        ready && "ring-2 ring-offset-2 ring-offset-surface",
                        small ? "text-[11px]" : "p-3 text-xs",
                      )}
                      style={{ borderColor: style.color, background: style.soft, ...(ready ? { ["--tw-ring-color" as string]: style.color } : {}) }}
                    >
                      {/* Progress through the cycle fills the square from the bottom. */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 opacity-25"
                        style={{ height: `${progress * 100}%`, background: style.color }}
                      />
                      <span className="relative flex items-start justify-between gap-1">
                        <span className={cx("truncate font-semibold text-ink", !small && "text-sm")}>{entry.pond.name}</span>
                        {entry.health && (
                          <span
                            className={cx("mt-1 size-2.5 shrink-0 rounded-full ring-2 ring-surface", healthDotClass(entry.health.level))}
                            title={t(`health.level.${entry.health.level}`)}
                          />
                        )}
                      </span>
                      <span className="relative">
                        {!small && running && entry.estimatedKg > 0 && (
                          <span className="block font-semibold tabular-nums text-ink">
                            ~{formatNumber(entry.estimatedKg, 0)} kg
                            <span className="font-normal text-ink-3"> · {t("unit.boxes", { n: entry.boxes })}</span>
                          </span>
                        )}
                        <span className={cx("block truncate", ready ? "font-semibold" : "text-ink-2")} style={ready ? { color: style.color } : undefined}>
                          {subtitle}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      <FarmMapLegend />
    </div>
  );
}

function FarmMapLegend() {
  const { t } = useI18n();
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {HARVESTABILITY_ORDER.filter((status) => status !== "unset").map((status) => (
        <li key={status} className="inline-flex items-center gap-1.5">
          <span
            className={cx("size-3 rounded-[3px] border-2", status === "empty" && "border-dashed")}
            style={{ borderColor: HARVESTABILITY[status].color, background: HARVESTABILITY[status].soft }}
          />
          {t(`harvestability.${status}`)}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5 text-ink-3">{t("farmMap.legendFill")}</li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-positive" />
        <span className="size-2.5 rounded-full bg-warning" />
        <span className="size-2.5 rounded-full bg-danger" />
        {t("farmMap.legendHealth")}
      </li>
    </ul>
  );
}

// One card per farm for businesses with too many ponds to show one by one:
// a strip with a cell per pond in harvest order, the counts, and the
// estimated stock. Each card opens that farm's own map and cycles.
export function FarmSummaryGrid({ farms }: { farms: FarmMapGroup[] }) {
  const { t } = useI18n();
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {farms.map((farm) => {
        const ordered = [...farm.ponds].sort(
          (a, b) => HARVESTABILITY_ORDER.indexOf(a.harvestability) - HARVESTABILITY_ORDER.indexOf(b.harvestability),
        );
        const standingKg = farm.ponds.reduce((sum, entry) => sum + entry.estimatedKg, 0);
        return (
          <li key={farm.id ?? "none"}>
            <Link
              href={farm.id === null ? "/farms" : `/farms/${farm.id}`}
              className="block h-full rounded-md border border-line bg-surface-2 p-4 transition-colors hover:border-line-strong"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="truncate font-semibold text-ink">{farm.name}</h3>
                <span className="shrink-0 font-mono text-xs text-ink-3 tabular-nums">{t("nav.farmPonds", { count: farm.ponds.length })}</span>
              </div>
              <div className="mt-3 flex h-3 gap-px overflow-hidden rounded-sm" aria-hidden="true">
                {ordered.map((entry) => (
                  <span
                    key={entry.pond.id}
                    className="flex-1"
                    style={{ background: HARVESTABILITY[entry.harvestability].color }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">
                {HARVESTABILITY_ORDER.filter((status) => farm.ponds.some((entry) => entry.harvestability === status))
                  .map((status) => `${farm.ponds.filter((entry) => entry.harvestability === status).length} ${t(`harvestability.${status}`)}`)
                  .join(" · ")}
              </p>
              <p className="mt-3 text-xl font-semibold tracking-tight text-ink tabular-nums">
                {formatNumber(standingKg, 0)}
                <span className="ml-1 text-sm font-medium text-ink-3">kg</span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
