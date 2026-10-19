"use client";

import Link from "next/link";
import type { getFeedTypes, getPondDetail } from "@backend/lib/queries";
import { addDays, dateToDayKey, daysBetween } from "@fisheye/shared/dates";
import { formatAbw, formatKg, formatNumber, formatPercent, formatRm } from "@fisheye/shared/format";
import { estimateBoxes } from "@fisheye/shared/harvest";
import BarChart, { type BarDatum } from "@/app/components/charts/BarChart";
import RecentLineChart from "@/app/components/charts/RecentLineChart";
import LineChart, { type LinePoint } from "@/app/components/charts/LineChart";
import { HealthBadge, healthDotClass } from "@/app/components/harvest";
import {
  BoxIcon,
  CalendarIcon,
  ChartIcon,
  CoinsIcon,
  FeedIcon,
  FishIcon,
  HeartPulseIcon,
  InfoIcon,
  PencilIcon,
  RulerIcon,
  ScaleIcon,
  SkullIcon,
  SparkleIcon,
} from "@/app/components/icons";
import { Card, CardHeader, EmptyState, Legend, StatCard, cx, feedColor } from "@/app/components/ui";
import { useI18n } from "@/app/components/I18nProvider";

type Detail = NonNullable<Awaited<ReturnType<typeof getPondDetail>>>;
type FeedTypes = Awaited<ReturnType<typeof getFeedTypes>>;

export default function PondOverview({
  detail,
  feedTypes,
  boxKg,
  today,
}: {
  detail: Detail;
  feedTypes: FeedTypes;
  boxKg: number;
  today: string;
}) {
  const { t, fmt } = useI18n();
  const { pond, logs, samplings, metrics } = detail;
  const feedTypeByCode = new Map(feedTypes.map((feedType) => [feedType.code, feedType]));

  const specsAndHealth = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <HealthCard detail={detail} today={today} />
      <SpecsCard detail={detail} today={today} />
    </div>
  );

  if (!metrics.lastLogDate) {
    return (
      <div className="space-y-6">
        {specsAndHealth}
        <Card>
          <EmptyState
            icon={<ChartIcon className="size-5" />}
            title={t("pond.noRecords", { pond: pond.name })}
            description={t("pond.noRecordsDescription")}
            action={
              <Link href={`/import?pond=${pond.id}`} className="text-sm font-semibold text-brand hover:underline">
                {t("pond.importSpreadsheet")}
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  // Daily feed across the whole cycle, one point per calendar day coloured by
  // feed type (unrecorded days leave a gap), plus a trailing 7-day average of the recorded days.
  const logByDay = new Map(logs.map((log) => [dateToDayKey(log.date), log]));
  const daily: LinePoint[] = [];
  const dayLabels: string[] = [];
  const averages: (number | null)[] = [];
  for (let day = metrics.firstLogDate!; day <= metrics.lastLogDate; day = addDays(day, 1)) {
    const log = logByDay.get(day);
    const window = Array.from({ length: 7 }, (_, offset) => logByDay.get(addDays(day, -offset))).filter((entry) => entry !== undefined);
    averages.push(window.length ? window.reduce((sum, entry) => sum + entry.feedKg, 0) / window.length : null);
    dayLabels.push(fmt.dayKey(day, { year: false }));
    daily.push({
      key: day,
      label: day.endsWith("-01") ? fmt.month(day.slice(0, 7)) : "",
      value: log ? log.feedKg : null,
      color: log?.feedType ? feedColor(log.feedTypeId) : "var(--ink-3)",
      tooltip: {
        title: fmt.dayKey(day, { weekday: true }),
        lines: log
          ? [
              {
                label: log.feedType?.code ?? t("log.noFeeding"),
                value: log.bags > 0 ? `${fmt.bags(log.bags)} · ${formatKg(log.feedKg, 0)}` : "—",
                color: log.feedType ? feedColor(log.feedTypeId) : undefined,
              },
              { label: t("overview.deadFish"), value: formatNumber(log.deadCount, 0) },
              ...(log.note ? [{ label: t("pond.note"), value: log.note.slice(0, 40) }] : []),
            ]
          : [{ label: t("pond.notRecorded"), value: "" }],
      },
    });
  }
  const latestAvg = averages[averages.length - 1];
  const previousAvg = averages.length > 7 ? averages[averages.length - 8] : null;
  const avgChange = latestAvg !== null && previousAvg ? (latestAvg - previousAvg) / previousAvg : null;
  const latestKg = logByDay.get(metrics.lastLogDate)!.feedKg;
  const missedDays = daily.filter((bar) => !logByDay.has(bar.key)).length;
  const growth: LinePoint[] = samplings.map((sampling) => ({
    key: String(sampling.id),
    label: fmt.day(sampling.date, { year: false }),
    value: sampling.avgWeightKg * 1000,
    tooltip: {
      title: fmt.day(sampling.date),
      lines: [
        { label: t("pond.averageWeight"), value: formatAbw(sampling.avgWeightKg) },
        ...(sampling.sampleSize ? [{ label: t("pond.fishWeighed"), value: String(sampling.sampleSize) }] : []),
      ],
    },
  }));

  const mortality: BarDatum[] = metrics.months.map((month) => ({
    key: month.monthKey,
    label: fmt.month(month.monthKey),
    segments: [{ name: "Dead", value: month.deadCount, color: "var(--danger)" }],
    tooltip: {
      title: fmt.month(month.monthKey, "long"),
      lines: [
        { label: t("overview.deadFish"), value: formatNumber(month.deadCount, 0) },
        { label: t("pond.weightLost"), value: formatKg(month.deadKg, 2) },
      ],
    },
  }));

  const latestMonth = metrics.months.at(-1);
  const previousMonth = metrics.months.at(-2);
  const lastSampleDays = metrics.daysSinceSampling;
  const harvestedAny = metrics.harvested.count > 0;

  return (
    <div className="space-y-6">
      <section aria-label={t("overview.keyFigures")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          emphasis
          label={t("pond.standingStock")}
          value={formatNumber(metrics.estimatedHarvestKg, 0)}
          unit="kg"
          icon={<ScaleIcon className="size-4" />}
          sub={
            harvestedAny
              ? t("pond.standingStockHarvested", {
                  boxes: estimateBoxes(metrics.estimatedHarvestKg, boxKg),
                  harvested: formatNumber(metrics.harvested.kg, 0),
                })
              : t("pond.standingStockSub", {
                  boxes: estimateBoxes(metrics.estimatedHarvestKg, boxKg),
                  feed: formatNumber(metrics.totals.feedKg, 0),
                  fcr: pond.assumedFcr,
                  dead: formatKg(metrics.totals.deadKg, 1),
                })
          }
        />
        <StatCard
          label={t("pond.abw")}
          value={metrics.latestSampling ? formatAbw(metrics.latestSampling.avgWeightKg) : "—"}
          icon={<FishIcon className="size-4" />}
          sub={
            metrics.latestSampling
              ? t("pond.sampledOn", { date: fmt.dayKey(metrics.latestSampling.date), n: lastSampleDays ?? 0 })
              : t("pond.noSampling")
          }
        />
        <StatCard
          label={t("pond.feedToDate")}
          value={formatNumber(metrics.totals.feedKg, 0)}
          unit="kg"
          icon={<FeedIcon className="size-4" />}
          sub={t("pond.feedToDateSub", { bags: fmt.bags(metrics.totals.bags), n: metrics.totals.daysLogged })}
        />
        <StatCard
          label={t("pond.feedCostCycle")}
          value={formatRm(metrics.totals.feedCostRm, 0)}
          icon={<CoinsIcon className="size-4" />}
          sub={
            metrics.feedCostPerKg
              ? t("pond.costPerKg", { cost: formatRm(metrics.feedCostPerKg) }) +
                (latestMonth ? ` · ${t("pond.costInMonth", { cost: formatRm(latestMonth.feedCostRm, 0), month: fmt.month(latestMonth.monthKey) })}` : "")
              : undefined
          }
        />
        <StatCard
          label={t("pond.deadToDate")}
          value={formatNumber(metrics.totals.deadCount, 0)}
          unit={t("unit.fish")}
          icon={<SkullIcon className="size-4" />}
          sub={
            metrics.survivalRate !== null
              ? t("pond.survivalSub", { percent: formatPercent(metrics.survivalRate), kg: formatKg(metrics.totals.deadKg, 1) })
              : t("pond.biomassLost", { kg: formatKg(metrics.totals.deadKg, 1) })
          }
        />
        {harvestedAny ? (
          <StatCard
            label={t("pond.harvestedCycle")}
            value={formatNumber(metrics.harvested.kg, 0)}
            unit="kg"
            icon={<BoxIcon className="size-4" />}
            sub={t("pond.harvestedCycleSub", { n: metrics.harvested.count, fish: formatNumber(metrics.harvested.fish, 0) })}
          />
        ) : (
          <StatCard
            label={latestMonth ? t("pond.feedInMonth", { month: fmt.month(latestMonth.monthKey, "long") }) : t("pond.feedThisMonth")}
            value={formatNumber(latestMonth?.feedKg ?? 0, 0)}
            unit="kg"
            icon={<ChartIcon className="size-4" />}
            change={
              latestMonth && previousMonth && previousMonth.feedKg > 0
                ? {
                    // Per logged day, so a month in progress compares fairly.
                    value: latestMonth.feedKg / latestMonth.daysLogged / (previousMonth.feedKg / previousMonth.daysLogged) - 1,
                    label: t("overview.dailyVs", { month: fmt.month(previousMonth.monthKey) }),
                    goodWhen: "up",
                  }
                : null
            }
          />
        )}
      </section>

      {specsAndHealth}

      {!pond.stockedCount && (
        <div className="flex items-start gap-3 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p className="text-pretty">
            {t("pond.noCountHint", { fcr: pond.assumedFcr })}{" "}
            <Link href={`/ponds/${pond.id}?view=settings`} className="font-semibold underline underline-offset-2">
              {t("pond.pondSettings")}
            </Link>
          </p>
        </div>
      )}

      {metrics.realizedFcr !== null && metrics.samplingBiomassKg !== null && (
        <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <Figure label={t("pond.biomassSampling")} value={formatKg(metrics.samplingBiomassKg, 0)} detail={t("pond.biomassSamplingDetail")} />
          <Figure
            label={t("pond.actualFcr")}
            value={formatNumber(metrics.realizedFcr, 2)}
            detail={harvestedAny ? t("pond.actualFcrHarvested", { fcr: pond.assumedFcr }) : t("pond.assumed", { fcr: pond.assumedFcr })}
          />
          <Figure
            label={t("pond.survival")}
            value={metrics.survivalRate !== null ? formatPercent(metrics.survivalRate) : "—"}
            detail={t("pond.stockedCount", { n: formatNumber(pond.stockedCount ?? 0, 0) })}
          />
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<FeedIcon className="size-4" />}
          title={t("pond.dailyFeed")}
          description={t("pond.dailyFeedDescription", { from: fmt.dayKey(metrics.firstLogDate!), to: fmt.dayKey(metrics.lastLogDate) })}
        />
        <div className="px-5 pt-3">
          <Legend
            items={metrics.feedTypes.map((usage) => ({
              label: usage.code,
              color: feedColor(feedTypeByCode.get(usage.code)?.id),
            }))}
          />
        </div>
        <dl className="mx-5 mt-4 grid grid-cols-3 divide-x divide-line rounded-lg bg-surface-2 py-3 text-center">
          <div className="px-2">
            <dt className="text-[11px] text-ink-3">{t("pond.feedLatest")}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink sm:text-lg">{formatKg(latestKg, 0)}</dd>
          </div>
          <div className="px-2">
            <dt className="text-[11px] text-ink-3">{t("pond.feedAvg7")}</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink sm:text-lg">
              {latestAvg !== null ? formatKg(latestAvg, 1) : "—"}
              {avgChange !== null && Math.abs(avgChange) >= 0.005 && (
                <span className={cx("ml-1 text-xs font-medium", avgChange > 0 ? "text-positive" : "text-warning")}>
                  {avgChange > 0 ? "▲" : "▼"}
                  {formatPercent(Math.abs(avgChange), 0)}
                </span>
              )}
            </dd>
          </div>
          <div className="px-2">
            <dt className="text-[11px] text-ink-3">{t("pond.feedMissed")}</dt>
            <dd className={cx("mt-0.5 text-base font-semibold tabular-nums sm:text-lg", missedDays > 0 ? "text-warning" : "text-ink")}>
              {formatNumber(missedDays, 0)}
            </dd>
          </div>
        </dl>
        <div className="hidden px-5 pt-4 pb-4 sm:block">
          <LineChart points={daily} unit="kg" height={250} minLabelSpacing={44} ariaLabel={t("pond.dailyFeedAria", { pond: pond.name })} />
        </div>
        <div className="px-3 pt-4 pb-4 sm:hidden">
          <RecentLineChart data={daily} dayLabels={dayLabels} unit="kg" height={220} ariaLabel={t("pond.dailyFeedAria", { pond: pond.name })} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<FishIcon className="size-4" />} title={t("pond.growth")} description={t("pond.growthDescription")} />
          <div className="px-3 pt-4 pb-4 sm:px-5">
            {growth.length > 0 ? (
              <LineChart points={growth} unit="g" ariaLabel={t("pond.growthAria", { pond: pond.name })} height={220} />
            ) : (
              <p className="py-16 text-center text-sm text-ink-3">{t("pond.noSamples")}</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader icon={<SkullIcon className="size-4" />} title={t("pond.deadByMonth")} description={t("pond.deadByMonthDescription")} />
          <div className="px-3 pt-4 pb-4 sm:px-5">
            <BarChart data={mortality} unit={t("unit.fish")} ariaLabel={t("pond.deadByMonthAria", { pond: pond.name })} height={220} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("pond.monthly")} description={t("pond.monthlyDescription")} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm tabular-nums">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-right text-xs font-medium text-ink-3">
                <th className="px-5 py-2.5 text-left font-medium">{t("pond.col.month")}</th>
                <th className="px-3 py-2.5 font-medium">{t("pond.col.days")}</th>
                <th className="px-3 py-2.5 font-medium">{t("pond.col.bags")}</th>
                <th className="px-3 py-2.5 font-medium">{t("pond.col.feed")}</th>
                <th className="px-3 py-2.5 font-medium">{t("overview.feedCost")}</th>
                <th className="px-3 py-2.5 font-medium">{t("overview.deadFish")}</th>
                <th className="px-3 py-2.5 font-medium">{t("table.avgWeight")}</th>
                <th className="px-3 py-2.5 font-medium">{t("pond.col.deadKg")}</th>
                <th className="px-3 py-2.5 font-medium">{t("pond.col.cumFeed")}</th>
                <th className="px-3 py-2.5 font-medium">{t("pond.col.harvested")}</th>
                <th className="px-5 py-2.5 font-medium">{t("pond.col.estStock")}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.months.map((month) => (
                <tr key={month.monthKey} className="border-b border-line text-right text-ink-2 hover:bg-surface-2">
                  <td className="px-5 py-2.5 text-left">
                    <Link href={`/ponds/${pond.id}?view=records&month=${month.monthKey}`} className="font-medium text-ink hover:text-brand">
                      {fmt.month(month.monthKey, "long")}
                    </Link>
                    {month.cultureMonth !== null && <span className="ml-2 text-xs text-ink-3">M{month.cultureMonth}</span>}
                  </td>
                  <td className="px-3 py-2.5">{month.daysLogged}</td>
                  <td className="px-3 py-2.5">{formatNumber(month.bags, 1)}</td>
                  <td className="px-3 py-2.5 text-ink">{formatNumber(month.feedKg, 0)}</td>
                  <td className="px-3 py-2.5">{formatRm(month.feedCostRm)}</td>
                  <td className="px-3 py-2.5">{month.deadCount}</td>
                  <td className="px-3 py-2.5">{month.avgWeightKg !== null ? formatAbw(month.avgWeightKg) : "—"}</td>
                  <td className="px-3 py-2.5">{formatNumber(month.deadKg, 2)}</td>
                  <td className="px-3 py-2.5">{formatNumber(month.cumulativeFeedKg, 0)}</td>
                  <td className="px-3 py-2.5">{month.harvestedKg > 0 ? `−${formatNumber(month.harvestedKg, 0)}` : "—"}</td>
                  <td className="px-5 py-2.5 font-medium text-ink">{formatNumber(month.estimatedBiomassKg, 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 text-right font-semibold text-ink">
                <td className="px-5 py-3 text-left">{t("pond.cycleTotal")}</td>
                <td className="px-3 py-3">{metrics.totals.daysLogged}</td>
                <td className="px-3 py-3">{formatNumber(metrics.totals.bags, 1)}</td>
                <td className="px-3 py-3">{formatNumber(metrics.totals.feedKg, 0)}</td>
                <td className="px-3 py-3">{formatRm(metrics.totals.feedCostRm)}</td>
                <td className="px-3 py-3">{metrics.totals.deadCount}</td>
                <td className="px-3 py-3">{metrics.latestSampling ? formatAbw(metrics.latestSampling.avgWeightKg) : "—"}</td>
                <td className="px-3 py-3">{formatNumber(metrics.totals.deadKg, 2)}</td>
                <td className="px-3 py-3">{formatNumber(metrics.totals.feedKg, 0)}</td>
                <td className="px-3 py-3">{metrics.harvested.kg > 0 ? `−${formatNumber(metrics.harvested.kg, 0)}` : "—"}</td>
                <td className="px-5 py-3">{formatNumber(metrics.estimatedHarvestKg, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title={t("pond.feedProgramme")} description={t("pond.feedProgrammeDescription")} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-right text-xs font-medium text-ink-3">
                  <th className="px-5 py-2.5 text-left font-medium">{t("pond.col.feedType")}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t("pond.col.period")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("pond.col.bags")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("pond.col.feed")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("pond.col.cost")}</th>
                  <th className="px-5 py-2.5 font-medium">{t("pond.col.share")}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.feedTypes.map((usage) => (
                  <tr key={usage.code} className="border-b border-line text-right text-ink-2 last:border-0">
                    <td className="px-5 py-2.5 text-left">
                      <span className="inline-flex items-center gap-2 font-medium text-ink">
                        <span className="size-2.5 rounded-[3px]" style={{ background: feedColor(feedTypeByCode.get(usage.code)?.id) }} />
                        {usage.code}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-left whitespace-nowrap">
                      {fmt.dayKey(usage.firstDate, { year: false })} – {fmt.dayKey(usage.lastDate, { year: false })}
                    </td>
                    <td className="px-3 py-2.5">{formatNumber(usage.bags, 1)}</td>
                    <td className="px-3 py-2.5">{formatNumber(usage.feedKg, 0)}</td>
                    <td className="px-3 py-2.5">{formatRm(usage.feedCostRm)}</td>
                    <td className="px-5 py-2.5">{formatPercent(metrics.totals.feedKg > 0 ? usage.feedKg / metrics.totals.feedKg : 0, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <SparkleIcon className="size-4" />
            </span>
            <h2 className="text-[15px] font-semibold text-ink">{t("pond.feedingLevel")}</h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <Row
              label={t("pond.avgDailyFeed")}
              value={formatKg(metrics.recentDailyFeedKg, 1)}
              detail={t("pond.sevenDaysTo", { date: fmt.dayKey(metrics.lastLogDate, { year: false }) })}
            />
            <Row
              label={t("pond.feedingRate")}
              value={metrics.feedingRatePercent !== null ? t("pond.feedingRateValue", { rate: formatNumber(metrics.feedingRatePercent, 2) }) : "—"}
              detail={t("pond.feedingRateDetail")}
            />
            <Row label={t("pond.currentFeed")} value={metrics.currentFeedCode ?? "—"} />
          </dl>
          <p className="mt-4 rounded-lg bg-surface-2 p-3 text-pretty text-xs leading-5 text-ink-3">{t("pond.nextPhase")}</p>
        </Card>
      </div>
    </div>
  );
}

// Is the pond healthy, and when must it be harvested?
function HealthCard({ detail, today }: { detail: Detail; today: string }) {
  const { t, fmt } = useI18n();
  const { health, timing, pond } = detail;
  return (
    <Card>
      <CardHeader
        icon={<HeartPulseIcon className="size-4" />}
        title={t("pond.healthTitle")}
        description={t("pond.healthDescription")}
        action={health ? <HealthBadge level={health.level} /> : undefined}
      />
      {!timing || !health ? (
        <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("pond.healthNotRunning")}</p>
      ) : (
        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2 p-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-ink-3">
                <CalendarIcon className="size-3.5" />
                {t("timing.harvestBy")}
              </p>
              <p className={cx("mt-1 text-lg font-semibold tabular-nums", timing.daysLeft <= 0 ? "text-danger" : timing.daysLeft <= 30 ? "text-warning" : "text-ink")}>
                {fmt.dayKey(timing.harvestBy)}
              </p>
              <p className="text-xs text-ink-2">
                {timing.daysLeft > 0 ? t("pond.daysLeft", { n: timing.daysLeft }) : timing.daysLeft === 0 ? t("time.today") : t("pond.daysOverdue", { n: -timing.daysLeft })}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-3">{t("pond.why")}</p>
              <p className="mt-1 text-sm text-ink-2">
                {timing.atTarget
                  ? t("pond.whyAtTarget", { target: formatAbw(timing.targetKg ?? 0) })
                  : timing.projectedAt && timing.harvestBy === timing.projectedAt
                    ? t("pond.whyProjected", { target: formatAbw(timing.targetKg ?? 0) })
                    : t("pond.whyPlanned", { months: pond.cycleMonths })}
              </p>
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
              <MiniFigure label={t("pond.plannedDate")} value={fmt.dayKey(timing.plannedAt, { year: false })} />
              <MiniFigure
                label={t("pond.targetSize")}
                value={timing.targetKg ? formatAbw(timing.targetKg) : "—"}
                link={timing.targetKg ? undefined : { href: `/ponds/${pond.id}?view=settings`, label: t("pond.setTarget") }}
              />
              <MiniFigure
                label={t("pond.reachesTarget")}
                value={
                  timing.atTarget
                    ? t("pond.reachedNow")
                    : timing.projectedAt
                      ? fmt.dayKey(timing.projectedAt, { year: false })
                      : timing.targetKg
                        ? t("pond.needTwoSamples")
                        : "—"
                }
              />
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {health.checks.length === 0 && <li className="text-sm text-ink-3">{t("pond.noChecks")}</li>}
            {health.checks.map((check) => (
              <li key={check.key} className="flex items-start gap-2.5 text-sm">
                <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", healthDotClass(check.level))} />
                <span className={check.level === "good" ? "text-ink-2" : "text-ink"}>
                  {t(check.key, {
                    ...check.params,
                    ...(check.key === "health.deathSpike" && check.params ? { date: fmt.dayKey(String(check.params.date), { year: false }) } : {}),
                  })}
                </span>
              </li>
            ))}
          </ul>
          {daysBetween(today, timing.harvestBy) <= 30 && (
            <Link href={`/ponds/${pond.id}?view=cycle`} className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline">
              {t("overview.recordHarvest")} →
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}

// The pond's physical specs and latest water condition.
function SpecsCard({ detail, today }: { detail: Detail; today: string }) {
  const { t, fmt } = useI18n();
  const { pond, farm } = detail;
  const volume = pond.areaM2 && pond.depthM ? pond.areaM2 * pond.depthM : null;
  const density = pond.stockedCount && pond.areaM2 ? pond.stockedCount / pond.areaM2 : null;
  const waterTone =
    pond.waterStatus === "poor" ? "text-danger" : pond.waterStatus === "fair" ? "text-warning" : pond.waterStatus === "good" ? "text-positive" : "text-ink-3";
  return (
    <Card>
      <div id="specs" className="scroll-mt-6" />
      <CardHeader
        icon={<RulerIcon className="size-4" />}
        title={t("specs.title")}
        description={t("specs.description")}
        action={
          <Link href={`/ponds/${pond.id}?view=settings#specs`} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            <PencilIcon className="size-3.5" />
            {t("specs.edit")}
          </Link>
        }
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm sm:grid-cols-3">
        <Spec label={t("specs.farm")} value={farm?.name} />
        <Spec label={t("specs.species")} value={pond.species} />
        <Spec label={t("specs.type")} value={pond.pondType} />
        <Spec label={t("specs.area")} value={pond.areaM2 ? `${formatNumber(pond.areaM2, 0)} m²` : null} />
        <Spec label={t("specs.depth")} value={pond.depthM ? `${formatNumber(pond.depthM, 1)} m` : null} />
        <Spec label={t("specs.volume")} value={volume ? `${formatNumber(volume, 0)} m³` : null} />
        <Spec label={t("specs.waterSource")} value={pond.waterSource} />
        <Spec label={t("specs.aerators")} value={pond.aerators !== null ? formatNumber(pond.aerators, 0) : null} />
        <Spec label={t("specs.density")} value={density ? t("specs.densityValue", { n: formatNumber(density, 1) }) : null} />
        <Spec label={t("specs.cycleLength")} value={t("specs.months", { n: pond.cycleMonths })} />
        <Spec label={t("specs.targetFcr")} value={String(pond.assumedFcr)} />
        <Spec label={t("pond.targetSize")} value={pond.targetWeightKg ? formatAbw(pond.targetWeightKg) : null} />
      </dl>
      <div className="mx-5 mb-5 rounded-lg border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">{t("specs.water")}</p>
          <p className={cx("text-sm font-semibold", waterTone)}>
            {pond.waterStatus ? t(`specs.water.${pond.waterStatus as "good" | "fair" | "poor"}`) : t("specs.notChecked")}
          </p>
        </div>
        {pond.waterNote && <p className="mt-1 text-sm text-ink-2">{pond.waterNote}</p>}
        {pond.waterCheckedAt && (
          <p className="mt-1 text-xs text-ink-3">
            {t("specs.checkedOn", { date: fmt.day(pond.waterCheckedAt), ago: fmt.relativeDays(dateToDayKey(pond.waterCheckedAt), today) })}
          </p>
        )}
      </div>
    </Card>
  );
}

function Spec({ label, value }: { label: string; value: string | null | undefined }) {
  const { t } = useI18n();
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cx("font-medium", value ? "text-ink" : "text-ink-3")}>{value || t("specs.notSet")}</dd>
    </div>
  );
}

function MiniFigure({ label, value, link }: { label: string; value: string; link?: { href: string; label: string } }) {
  return (
    <div>
      <p className="text-ink-3">{label}</p>
      <p className="font-medium tabular-nums text-ink">{value}</p>
      {link && (
        <Link href={link.href} className="text-brand hover:underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}

function Figure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-xs text-ink-3">{detail}</p>
    </div>
  );
}

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-ink-2">
        {label}
        {detail && <span className="block text-xs text-ink-3">{detail}</span>}
      </dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
