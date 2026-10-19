"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { deleteHarvest, reopenLastCycle } from "@/lib/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import { FcrValue, harvestLabel } from "@/app/components/cycle";
import { GradeMixBar } from "@/app/components/harvest";
import { CheckIcon, HarvestIcon, XIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, EmptyState, cx } from "@/app/components/ui";
import { addDays, dateToDayKey, daysBetween } from "@fisheye/shared/dates";
import { formatAbw, formatKg, formatNumber, formatPercent, formatRm } from "@fisheye/shared/format";
import { averageFishKg, cultureDay, gradeMix, topGrade, type HarvestRecord } from "@fisheye/shared/harvest";
import type { getPondDetail, getSizeGrades } from "@backend/lib/queries";
import { HarvestForm, LossForm, StartCycleForm } from "./CycleForms";
import { useI18n } from "@/app/components/I18nProvider";

type Detail = NonNullable<Awaited<ReturnType<typeof getPondDetail>>>;

export default function PondCycle({
  detail,
  today,
  boxKg,
  grades,
  suggestion,
}: {
  detail: Detail;
  today: string;
  boxKg: number;
  grades: Awaited<ReturnType<typeof getSizeGrades>>;
  suggestion: string | null;
}) {
  const { t, fmt } = useI18n();
  const { pond, cycle, cycles, metrics, runningHarvests, harvests } = detail;
  const running = cycle.state === "growing" || cycle.state === "ready";
  const lastEnd = cycles[0] ? dateToDayKey(cycles[0].endedAt) : null;
  // Estimated stock before any harvest this cycle; each harvest comes off it.
  const grossKg = metrics.estimatedHarvestKg + metrics.harvested.kg;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {running && (
          <>
            <HarvestForm
              pondId={pond.id}
              today={today}
              stockedAt={cycle.stockedAt}
              grades={grades.map((grade) => ({ id: grade.id, label: grade.label }))}
              boxKg={boxKg}
              standingKg={metrics.estimatedHarvestKg}
              harvestedKg={metrics.harvested.kg}
              feedKg={metrics.totals.feedKg}
              targetFcr={pond.assumedFcr}
            />
            {grades.length === 0 && (
              <p className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
                {t("cycleTab.noGrades")}{" "}
                <Link href="/settings#grades" className="font-semibold underline">
                  {t("nav.settings")}
                </Link>
              </p>
            )}
            <LossForm
              pondId={pond.id}
              today={today}
              stockedAt={cycle.stockedAt}
              fishLeft={metrics.fishAlive}
              allDead={Boolean(pond.stockedCount && metrics.totals.deadCount >= pond.stockedCount)}
            />
          </>
        )}
        {!running && (
          <>
            {cycle.state === "empty" && (
              <Card className={cx("flex items-start gap-3 p-5", cycle.lastOutcome === "lost" && "border-danger/30 bg-danger-soft")}>
                <span
                  className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-white",
                    cycle.lastOutcome === "lost" ? "bg-danger" : "bg-positive",
                  )}
                >
                  {cycle.lastOutcome === "lost" ? <XIcon className="size-4" strokeWidth={2.4} /> : <CheckIcon className="size-4" strokeWidth={2.4} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{cycle.lastOutcome === "lost" ? t("cycleTab.emptyLost") : t("cycleTab.emptyHarvested")}</p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {t("cycleTab.emptyDetail", { label: harvestLabel(cycle, today, t), date: fmt.day(cycles[0].endedAt) })}
                  </p>
                </div>
                <ConfirmButton
                  action={reopenLastCycle}
                  fields={{ pondId: String(pond.id) }}
                  message={t("cycleTab.reopenConfirm", { n: cycles[0].number })}
                  label={t("cycleTab.reopen")}
                  className="text-ink-2!"
                >
                  {t("cycleTab.undo")}
                </ConfirmButton>
              </Card>
            )}
            <StartCycleForm pondId={pond.id} today={today} minDate={lastEnd ? addDays(lastEnd, 1) : null} suggestion={suggestion} />
          </>
        )}
      </div>

      <div className="space-y-6">
        {running && (
          <Card>
            <CardHeader
              icon={<HarvestIcon className="size-4" />}
              title={t("cycleTab.thisCycle")}
              description={t("cycleTab.thisCycleDescription")}
              action={runningHarvests.length > 0 ? <Badge>{runningHarvests.length}</Badge> : undefined}
            />
            {runningHarvests.length === 0 ? (
              <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("cycleTab.noneYet", { kg: formatNumber(metrics.estimatedHarvestKg, 0) })}</p>
            ) : (
              <HarvestList harvests={runningHarvests} stockedAt={cycle.stockedAt} grossKg={grossKg} deletable />
            )}
          </Card>
        )}

        <Card>
          <CardHeader title={t("cycleTab.past")} description={t("cycleTab.pastDescription")} />
          {cycles.length === 0 ? (
            <EmptyState title={t("cycleTab.noPast")} description={t("cycleTab.noPastDescription")} />
          ) : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {cycles.map((past) => {
                const lost = past.outcome === "lost";
                const days = daysBetween(dateToDayKey(past.stockedAt), dateToDayKey(past.endedAt));
                const fcr = !lost && past.harvestKg ? past.feedKg / past.harvestKg : null;
                const survival = past.stockedCount ? Math.max(past.stockedCount - past.deadCount, 0) / past.stockedCount : null;
                const pastHarvests = harvests.filter((harvest) => harvest.cycleId === past.id);
                const mix = gradeMix(pastHarvests.flatMap((harvest) => harvest.lines));
                return (
                  <li key={past.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{t("harvest.cycleN", { n: past.number })}</p>
                      <Badge tone={lost ? "danger" : "positive"}>
                        {lost ? t("cycleTab.lostCause", { cause: past.cause ?? t("cycleTab.noCause") }) : t("cycleTab.harvested")}
                      </Badge>
                      <span className="text-xs text-ink-3">
                        {fmt.day(past.stockedAt)} – {fmt.day(past.endedAt)} · {t("unit.days", { n: days })}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                      {lost ? (
                        <>
                          <Stat label={t("cycleTab.harvest")} value={formatKg(past.harvestKg ?? 0, 0)} danger={!past.harvestKg} />
                          <Stat label={t("cycleTab.feedUsed")} value={formatKg(past.feedKg, 0)} />
                          <Stat label={t("overview.feedCost")} value={formatRm(past.feedCostRm, 0)} sub={t("cycleTab.writtenOff")} />
                          <Stat
                            label={t("cycleTab.fishLost")}
                            value={formatNumber(past.deadCount + (past.fishCount ?? 0), 0)}
                            sub={past.stockedCount ? t("cycleTab.ofStocked", { n: formatNumber(past.stockedCount, 0) }) : undefined}
                          />
                        </>
                      ) : (
                        <>
                          <Stat
                            label={t("cycleTab.harvested")}
                            value={formatKg(past.harvestKg ?? 0, 0)}
                            sub={t("cycleTab.inHarvests", { n: Math.max(pastHarvests.length, 1) })}
                          />
                          <Stat label={t("cycleTab.feedUsed")} value={formatKg(past.feedKg, 0)} sub={formatRm(past.feedCostRm, 0)} />
                          <Stat
                            label={t("harvests.col.finalFcr")}
                            value={<FcrValue fcr={fcr} target={pond.assumedFcr} />}
                            sub={t("fcr.target", { target: pond.assumedFcr })}
                          />
                          <Stat
                            label={t("harvests.col.costPerKg")}
                            value={past.harvestKg ? formatRm(past.feedCostRm / past.harvestKg) : "—"}
                            sub={survival !== null ? t("cycleTab.survival", { percent: formatPercent(survival) }) : undefined}
                          />
                        </>
                      )}
                    </dl>
                    {mix.length > 0 && (
                      <div className="mt-3">
                        <GradeMixBar mix={mix} />
                      </div>
                    )}
                    {pastHarvests.length > 1 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-brand">
                          {t("cycleTab.showHarvests", { n: pastHarvests.length })}
                        </summary>
                        <div className="-mx-5 mt-2">
                          <HarvestList
                            harvests={pastHarvests}
                            stockedAt={dateToDayKey(past.stockedAt)}
                            grossKg={pastHarvests.reduce((sum, harvest) => sum + harvest.totalKg, 0)}
                          />
                        </div>
                      </details>
                    )}
                    {past.note && <p className="mt-2 text-sm text-ink-3">{past.note}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// Harvests in order, each with its day of culture, size mix and the stock
// left once it was taken out.
function HarvestList({
  harvests,
  stockedAt,
  grossKg,
  deletable = false,
}: {
  harvests: (HarvestRecord & { cycleId: number | null })[];
  stockedAt: string;
  grossKg: number;
  deletable?: boolean;
}) {
  const { t, fmt } = useI18n();
  // Running total harvested up to and including each harvest.
  const taken = harvests.map((_, index) => harvests.slice(0, index + 1).reduce((sum, harvest) => sum + harvest.totalKg, 0));
  return (
    <ol className="mt-3 divide-y divide-line border-t border-line">
      {harvests.map((harvest, index) => {
        const left = Math.max(grossKg - taken[index], 0);
        const mix = gradeMix(harvest.lines);
        const top = topGrade(mix);
        const avgFish = averageFishKg(harvest);
        return (
          <li key={harvest.id} className="px-5 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {t("cycleTab.harvestN", { n: index + 1 })}
                  <span className="font-normal text-ink-3">· {fmt.day(harvest.date)}</span>
                  <Badge tone="brand">{t("harvests.dayN", { day: cultureDay(stockedAt, harvest.date) })}</Badge>
                  {harvest.isFinal && <Badge tone="positive">{t("harvest.final")}</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-ink-2 tabular-nums">
                  <span className="font-semibold text-ink">{formatKg(harvest.totalKg, 0)}</span>
                  {harvest.boxes !== null && ` · ${t("unit.boxes", { n: harvest.boxes })}`}
                  {harvest.fishCount !== null && ` · ${formatNumber(harvest.fishCount, 0)} ${t("unit.fish")}`}
                  {avgFish !== null && ` · ${t("cycleTab.avg", { abw: formatAbw(avgFish) })}`}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="text-right">
                  <p className="text-xs text-ink-3">{t("cycleTab.leftAfter")}</p>
                  <p className="text-sm font-medium tabular-nums text-ink">{formatKg(left, 0)}</p>
                </div>
                {deletable && harvest.cycleId === null && (
                  <ConfirmButton
                    action={deleteHarvest}
                    fields={{ id: String(harvest.id) }}
                    message={t("cycleTab.deleteConfirm", { kg: formatNumber(harvest.totalKg, 0), date: fmt.day(harvest.date) })}
                    label={t("cycleTab.delete")}
                  />
                )}
              </div>
            </div>
            {mix.length > 0 && (
              <div className="mt-2">
                <GradeMixBar mix={mix} />
                {top && (
                  <p className="mt-1 text-xs text-ink-3">{t("cycleTab.mostlySize", { label: top.label, percent: formatPercent(top.share, 0) })}</p>
                )}
              </div>
            )}
            {harvest.note && <p className="mt-1 text-xs text-ink-3">{harvest.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, sub, danger }: { label: string; value: ReactNode; sub?: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cx("font-medium tabular-nums", danger ? "text-danger" : "text-ink")}>{value}</dd>
      {sub && <dd className="text-xs text-ink-3">{sub}</dd>}
    </div>
  );
}
