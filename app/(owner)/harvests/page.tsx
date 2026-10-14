import type { Metadata } from "next";
import Link from "next/link";
import { addMonths, dateToDayKey, monthKeyOf, todayKey } from "@/lib/dates";
import { formatAbw, formatKg, formatNumber, formatPercent, formatRm } from "@/lib/format";
import { averageFishKg, cultureDay, gradeMix, harvestTotals, topGrade } from "@/lib/harvest";
import { getI18n } from "@/lib/i18n/server";
import { getClosedCycles, getHarvestLog, getPondList } from "@/lib/queries";
import BarChart, { type BarDatum } from "@/app/components/charts/BarChart";
import { FcrValue } from "@/app/components/cycle";
import { GradeMixBar, gradeColor } from "@/app/components/harvest";
import { BoxIcon, CalendarIcon, ChartIcon, FishIcon, HarvestIcon, ScaleIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, EmptyState, Legend, PageHeader, StatCard, cx } from "@/app/components/ui";
import PondPicker from "./PondPicker";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("harvests.title") };
}

const MONTHS_SHOWN = 12;
// Above this many ponds the filter is a searchable picker instead of chips.
const MAX_POND_CHIPS = 12;

export default async function HarvestsPage({ searchParams }: PageProps<"/harvests">) {
  const today = todayKey();
  const { t, fmt } = await getI18n();
  const query = await searchParams;
  const [allHarvests, ponds, cycles] = await Promise.all([getHarvestLog(), getPondList(), getClosedCycles()]);

  const pondFilter = typeof query.pond === "string" ? Number(query.pond) : null;
  const farmFilter = typeof query.farm === "string" ? Number(query.farm) : null;
  const farms = [...new Map(ponds.flatMap((pond) => (pond.farm ? [[pond.farm.id, pond.farm] as const] : []))).values()];
  const farmPondIds = new Set(ponds.filter((pond) => farmFilter !== null && pond.farm?.id === farmFilter).map((pond) => pond.id));
  const inFilter = (pondId: number) => (pondFilter ? pondId === pondFilter : farmFilter ? farmPondIds.has(pondId) : true);
  const harvests = allHarvests.filter((harvest) => inFilter(harvest.pondId));
  const closedCycles = cycles.filter((cycle) => inFilter(cycle.pondId));

  const totals = harvestTotals(harvests);
  const mix = gradeMix(harvests.flatMap((harvest) => harvest.lines));
  const top = topGrade(mix);
  const days = harvests.filter((harvest) => harvest.stockedAt).map((harvest) => cultureDay(harvest.stockedAt!, harvest.date));
  const avgDay = days.length > 0 ? days.reduce((sum, day) => sum + day, 0) / days.length : null;
  const thisYear = today.slice(0, 4);
  const yearKg = harvests.filter((harvest) => dateToDayKey(harvest.date).startsWith(thisYear)).reduce((sum, h) => sum + h.totalKg, 0);

  // Monthly harvested weight, stacked by pond, for the last twelve months.
  const firstMonth = addMonths(today.slice(0, 7), -(MONTHS_SHOWN - 1));
  const pondIds = [...new Set(harvests.map((harvest) => harvest.pondId))];
  const pondColor = (pondId: number) => `var(--series-${(pondIds.indexOf(pondId) % 8) + 1})`;
  const chart: BarDatum[] = Array.from({ length: MONTHS_SHOWN }, (_, index) => {
    const monthKey = addMonths(firstMonth, index);
    const inMonth = harvests.filter((harvest) => monthKeyOf(harvest.date) === monthKey);
    return {
      key: monthKey,
      label: fmt.month(monthKey),
      segments: pondIds.map((pondId) => ({
        name: String(pondId),
        value: inMonth.filter((harvest) => harvest.pondId === pondId).reduce((sum, harvest) => sum + harvest.totalKg, 0),
        color: pondColor(pondId),
      })),
      tooltip: {
        title: fmt.month(monthKey, "long"),
        lines: inMonth.length
          ? pondIds
              .map((pondId) => ({
                pondId,
                kg: inMonth.filter((harvest) => harvest.pondId === pondId).reduce((sum, harvest) => sum + harvest.totalKg, 0),
              }))
              .filter((entry) => entry.kg > 0)
              .map((entry) => ({
                label: harvests.find((harvest) => harvest.pondId === entry.pondId)!.pond.name,
                value: formatKg(entry.kg, 0),
                color: pondColor(entry.pondId),
              }))
          : [{ label: t("harvests.noneInMonth"), value: "" }],
      },
    };
  });

  return (
    <>
      <PageHeader
        eyebrow={t("harvests.eyebrow")}
        title={t("harvests.title")}
        description={t("harvests.description")}
      />

      {ponds.length > MAX_POND_CHIPS ? (
        <div className="mb-6 space-y-3">
          {farms.length > 1 && (
            <nav aria-label={t("harvests.filterFarm")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <ul className="flex min-w-max gap-1.5">
                {[{ id: null as number | null, name: t("harvests.allFarms") }, ...farms].map((farm) => {
                  const active = farm.id === farmFilter;
                  const count =
                    farm.id === null
                      ? allHarvests.length
                      : allHarvests.filter((harvest) => ponds.find((pond) => pond.id === harvest.pondId)?.farm?.id === farm.id).length;
                  return (
                    <li key={farm.id ?? "all"}>
                      <Link
                        href={farm.id === null ? "/harvests" : `/harvests?farm=${farm.id}`}
                        scroll={false}
                        aria-current={active ? "true" : undefined}
                        className={cx(
                          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
                          active ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                        )}
                      >
                        {farm.name}
                        <span className="tabular-nums text-ink-3">{count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          <PondPicker
            ponds={ponds
              .filter((pond) => farmFilter === null || pond.farm?.id === farmFilter)
              .map((pond) => ({
                id: pond.id,
                name: pond.name,
                farm: pond.farm?.name ?? null,
                count: allHarvests.filter((harvest) => harvest.pondId === pond.id).length,
              }))}
            total={farmFilter === null ? allHarvests.length : allHarvests.filter((harvest) => farmPondIds.has(harvest.pondId)).length}
            selected={pondFilter}
            farm={farms.find((farm) => farm.id === farmFilter) ?? null}
          />
        </div>
      ) : (
        <nav aria-label={t("harvests.filterPond")} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1.5">
            {[{ id: null as number | null, name: t("overview.all") }, ...ponds].map((pond) => {
              const active = pond.id === pondFilter;
              const count = pond.id === null ? allHarvests.length : allHarvests.filter((harvest) => harvest.pondId === pond.id).length;
              return (
                <li key={pond.id ?? "all"}>
                  <Link
                    href={pond.id === null ? "/harvests" : `/harvests?pond=${pond.id}`}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={cx(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
                      active ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                    )}
                  >
                    {pond.name}
                    <span className="tabular-nums text-ink-3">{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <section aria-label={t("overview.keyFigures")} className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          emphasis
          label={t("harvests.totalHarvested")}
          value={formatNumber(totals.kg, 0)}
          unit="kg"
          icon={<ScaleIcon className="size-4" />}
          sub={t("harvests.totalSub", { n: totals.count, year: thisYear, kg: formatNumber(yearKg, 0) })}
        />
        <StatCard
          label={t("harvests.avgDay")}
          value={avgDay !== null ? t("harvests.dayN", { day: Math.round(avgDay) }) : "—"}
          icon={<CalendarIcon className="size-4" />}
          sub={avgDay !== null ? t("harvests.avgDaySub", { months: formatNumber(avgDay / 30.4, 1) }) : undefined}
        />
        <StatCard
          label={t("harvests.topSize")}
          value={top ? top.label : "—"}
          icon={<FishIcon className="size-4" />}
          sub={top ? t("harvests.topSizeSub", { percent: formatPercent(top.share, 0), kg: formatNumber(top.kg, 0) }) : t("harvest.noGrades")}
        />
        <StatCard
          label={t("harvests.avgFish")}
          value={totals.fish > 0 ? formatAbw(totals.countedKg / totals.fish) : "—"}
          icon={<BoxIcon className="size-4" />}
          sub={totals.fish > 0 ? t("harvests.fishCounted", { n: formatNumber(totals.fish, 0) }) : t("harvests.noFishCount")}
        />
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader
            icon={<ChartIcon className="size-4" />}
            title={t("harvests.monthlyTitle")}
            description={t("harvests.monthlyDescription")}
            action={
              pondIds.length > 1 ? (
                <Legend
                  items={pondIds.map((pondId) => ({
                    label: harvests.find((harvest) => harvest.pondId === pondId)!.pond.name,
                    color: pondColor(pondId),
                  }))}
                />
              ) : undefined
            }
          />
          <div className="px-3 pt-4 pb-4 sm:px-5">
            <BarChart data={chart} unit="kg" height={260} ariaLabel={t("harvests.monthlyTitle")} />
          </div>
        </Card>

        <Card>
          <CardHeader icon={<FishIcon className="size-4" />} title={t("harvests.sizeTitle")} description={t("harvests.sizeDescription")} />
          {mix.length === 0 ? (
            <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("harvests.sizeEmpty")}</p>
          ) : (
            <div className="p-5">
              <ul className="space-y-3">
                {mix.map((entry) => (
                  <li key={entry.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className={cx("inline-flex items-center gap-2", entry.id === top?.id ? "font-semibold text-ink" : "text-ink-2")}>
                        <span className="size-2.5 rounded-[3px]" style={{ background: gradeColor(entry.sortOrder) }} />
                        {entry.label}
                        {entry.id === top?.id && <Badge tone="brand">{t("harvests.most")}</Badge>}
                      </span>
                      <span className="tabular-nums text-ink">
                        {formatPercent(entry.share, 1)} <span className="text-xs text-ink-3">· {formatKg(entry.kg, 0)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
                      <div className="grow-x h-full rounded-full" style={{ width: `${entry.share * 100}%`, background: gradeColor(entry.sortOrder) }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader icon={<HarvestIcon className="size-4" />} title={t("harvests.logTitle")} description={t("harvests.logDescription")} />
        {harvests.length === 0 ? (
          <EmptyState title={t("harvests.emptyTitle")} description={t("harvests.emptyDescription")} />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-3">
                  <th className="px-5 py-2.5 font-medium">{t("harvests.col.date")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("table.pond")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("harvests.col.day")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("harvests.col.weight")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("harvests.col.boxes")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("harvests.col.fish")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("harvests.col.avgFish")}</th>
                  <th className="w-[280px] px-3 py-2.5 font-medium">{t("harvests.col.sizes")}</th>
                  <th className="px-5 py-2.5 font-medium">{t("harvests.col.note")}</th>
                </tr>
              </thead>
              <tbody>
                {harvests.map((harvest) => {
                  const day = harvest.stockedAt ? cultureDay(harvest.stockedAt, harvest.date) : null;
                  const avgFish = averageFishKg(harvest);
                  return (
                    <tr key={harvest.id} className="border-b border-line align-top last:border-0 hover:bg-surface-2">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="font-medium text-ink">{fmt.day(harvest.date)}</p>
                        {harvest.isFinal && <Badge tone="positive" className="mt-1">{t("harvest.final")}</Badge>}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/ponds/${harvest.pond.id}?view=cycle`} className="font-medium text-ink hover:text-brand">
                          {harvest.pond.name}
                        </Link>
                        <p className="text-xs text-ink-3">
                          {harvest.cycle ? t("harvest.cycleN", { n: harvest.cycle.number }) : t("harvest.currentCycle")}
                        </p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {day !== null ? (
                          <>
                            <p className="font-medium tabular-nums text-ink">{t("harvests.dayN", { day })}</p>
                            <p className="text-xs text-ink-3">{t("harvests.monthN", { month: formatNumber(day / 30.4, 1) })}</p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink">{formatKg(harvest.totalKg, 0)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-2">{harvest.boxes !== null ? formatNumber(harvest.boxes, 1) : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-2">
                        {harvest.fishCount !== null ? formatNumber(harvest.fishCount, 0) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-2">{avgFish !== null ? formatAbw(avgFish) : "—"}</td>
                      <td className="px-3 py-3">
                        <GradeMixBar mix={gradeMix(harvest.lines)} compact />
                      </td>
                      <td className="max-w-56 px-5 py-3 text-xs text-ink-3">{harvest.note ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={t("harvests.cyclesTitle")} description={t("harvests.cyclesDescription")} />
        {closedCycles.length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("harvests.cyclesEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm tabular-nums">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-right text-xs text-ink-3">
                  <th className="px-5 py-2.5 text-left font-medium">{t("table.pond")}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t("harvests.col.period")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("harvests.col.harvests")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("harvests.col.totalHarvested")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("harvests.col.feed")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("harvests.col.finalFcr")}</th>
                  <th className="px-5 py-2.5 font-medium">{t("harvests.col.costPerKg")}</th>
                </tr>
              </thead>
              <tbody>
                {closedCycles.map((cycle) => {
                  const lost = cycle.outcome === "lost";
                  const fcr = cycle.harvestKg ? cycle.feedKg / cycle.harvestKg : null;
                  return (
                    <tr key={cycle.id} className="border-b border-line text-right last:border-0">
                      <td className="px-5 py-3 text-left">
                        <Link href={`/ponds/${cycle.pond.id}?view=cycle`} className="font-medium text-ink hover:text-brand">
                          {cycle.pond.name}
                        </Link>
                        <p className="text-xs text-ink-3">
                          {t("harvest.cycleN", { n: cycle.number })}
                          {lost && <span className="ml-1 text-danger">· {t("harvest.lost")}</span>}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-left text-ink-2">
                        {fmt.day(cycle.stockedAt, { year: false })} – {fmt.day(cycle.endedAt)}
                      </td>
                      <td className="px-3 py-3 text-ink-2">{cycle._count.harvests}</td>
                      <td className="px-3 py-3 font-medium text-ink">{formatKg(cycle.harvestKg ?? 0, 0)}</td>
                      <td className="px-3 py-3 text-ink-2">{formatKg(cycle.feedKg, 0)}</td>
                      <td className="px-3 py-3">
                        {lost ? "—" : <FcrValue fcr={fcr} target={cycle.pond.assumedFcr} />}
                      </td>
                      <td className="px-5 py-3 text-ink-2">{cycle.harvestKg ? formatRm(cycle.feedCostRm / cycle.harvestKg) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
