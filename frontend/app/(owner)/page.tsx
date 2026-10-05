"use client";

import Link from "next/link";
import { dateToDayKey, daysBetween, daysInMonth } from "@fisheye/shared/dates";
import { formatAbw, formatKg, formatNumber, formatRm } from "@fisheye/shared/format";
import { buildInsights, type Insight } from "@/lib/insights";
import { STAGES, harvestForecast, type CycleStatus, type StageKey } from "@fisheye/shared/cycle";
import { estimateBoxes } from "@fisheye/shared/harvest";
import { MANY_PONDS, buildFarmGroups } from "@/lib/farmMap";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { overviewData } from "@backend/lib/pages";
import BarChart, { type BarDatum } from "../components/charts/BarChart";
import { CycleBoard, CycleProgress, FcrValue, StageBadge, stageLabel } from "../components/cycle";
import { FarmMap, FarmSummaryGrid, HealthBadge } from "../components/harvest";
import Sparkline from "../components/charts/Sparkline";
import {
  AlertIcon,
  CalendarIcon,
  ArrowRightIcon,
  BoxIcon,
  ChartIcon,
  ChevronRightIcon,
  ClipboardIcon,
  FeedIcon,
  HarvestIcon,
  InfoIcon,
  MapIcon,
  ScaleIcon,
  SkullIcon,
  UploadIcon,
} from "../components/icons";
import { Badge, Card, CardHeader, EmptyState, Legend, PageHeader, SplitStatCard, StatCard, buttonClass, cx } from "../components/ui";

// Past this many ponds the feed chart stacks by farm instead of by pond.
const MAX_POND_SERIES = 8;
// The ready banner shows this many ponds and links to the farm map for the rest.
const MAX_READY_CARDS = 6;
// Rows the pond table shows before "Show all".
const TABLE_LIMIT = 15;

type StageFilter = StageKey | "empty";

function stageFilterOf(cycle: CycleStatus): StageFilter | null {
  if (cycle.state === "growing" || cycle.state === "ready") return cycle.stage.key;
  return cycle.state === "empty" ? "empty" : null;
}

type OverviewData = Awaited<ReturnType<typeof overviewData>>;

export default function OverviewPage() {
  return <Api<OverviewData> path="/overview">{(data) => <Overview data={data} />}</Api>;
}

function Overview({ data }: { data: OverviewData }) {
  const { today, ponds, stock, batches, activity, farms, boxKg, monthCost } = data;
  const i18n = useI18n();
  const { t, fmt } = i18n;
  useTitle(t("meta.title"), true);
  const query = useSearchParams();
  const requestedStage = query.get("stage");

  const withData = ponds.filter((entry) => entry.metrics.lastLogDate);
  const findingsCount = batches.reduce(
    (sum, batch) => sum + batch.findings.filter((finding) => finding.severity === "warning").length,
    0,
  );
  // Feed cost on the latest day anyone logged, across every pond.
  const latestDay = withData.map(({ metrics }) => metrics.lastLogDate!).sort().at(-1) ?? null;
  const daily = { dayKey: latestDay, costRm: 0, ponds: 0 };
  for (const { logs } of withData) {
    const cost = logs.filter((log) => dateToDayKey(log.date) === latestDay).reduce((sum, log) => sum + log.feedCostRm, 0);
    if (cost > 0) {
      daily.costRm += cost;
      daily.ponds += 1;
    }
  }
  const insights = buildInsights(ponds, stock.levels, findingsCount, today, i18n);
  const forecast = harvestForecast(ponds, today);
  const readyPonds = ponds.filter((entry) => entry.harvestability === "ready");
  const farmGroups = buildFarmGroups(ponds, farms, boxKg, t("farmMap.unassigned"));

  const filters = [
    ...STAGES.map((stage) => ({ key: stage.key as StageFilter, label: stageLabel(t, stage.key), color: stage.color as string | null })),
    { key: "empty" as StageFilter, label: t("harvestability.empty"), color: "var(--line-strong)" },
  ].map((filter) => ({ ...filter, count: ponds.filter(({ cycle }) => stageFilterOf(cycle) === filter.key).length }));
  const activeFilter = filters.find((filter) => filter.key === requestedStage && filter.count > 0)?.key ?? null;
  const filteredPonds = activeFilter ? ponds.filter(({ cycle }) => stageFilterOf(cycle) === activeFilter) : ponds;
  // A long pond list is cut short until asked for in full.
  const tablePonds = query.get("all") === "1" ? filteredPonds : filteredPonds.slice(0, TABLE_LIMIT);

  const nextHarvest = ponds
    .flatMap(({ pond, cycle }) => (cycle.state === "growing" || cycle.state === "ready" ? [{ pond, cycle }] : []))
    .sort((a, b) => a.cycle.plannedHarvestAt.localeCompare(b.cycle.plannedHarvestAt))[0];

  const totals = withData.reduce(
    (sum, { metrics }) => ({
      harvestKg: sum.harvestKg + metrics.estimatedHarvestKg,
      feedKg: sum.feedKg + metrics.totals.feedKg,
      costRm: sum.costRm + metrics.totals.feedCostRm,
      dead: sum.dead + metrics.totals.deadCount,
      harvestedKg: sum.harvestedKg + metrics.harvested.kg,
    }),
    { harvestKg: 0, feedKg: 0, costRm: 0, dead: 0, harvestedKg: 0 },
  );

  // Farm-wide monthly series, stacked by pond, or by farm once there are
  // too many ponds for a colour each.
  const monthKeys = [...new Set(withData.flatMap(({ metrics }) => metrics.months.map((month) => month.monthKey)))].sort();
  const seriesColor = (index: number) => `var(--series-${(index % 8) + 1})`;
  const stackByFarm = withData.length > MAX_POND_SERIES;
  const series = stackByFarm
    ? farmGroups
        .map((group) => ({ name: group.name, entries: withData.filter((entry) => (entry.farm?.id ?? null) === group.id) }))
        .filter((group) => group.entries.length > 0)
    : withData.map((entry) => ({ name: entry.pond.name, entries: [entry] }));
  const monthly = monthKeys.map((monthKey) => {
    const rows = series.map(({ name, entries }, index) => {
      const months = entries.flatMap(({ metrics }) => metrics.months.filter((month) => month.monthKey === monthKey));
      return {
        name,
        color: seriesColor(index),
        row:
          months.length === 0
            ? undefined
            : {
                feedKg: months.reduce((sum, month) => sum + month.feedKg, 0),
                feedCostRm: months.reduce((sum, month) => sum + month.feedCostRm, 0),
                deadCount: months.reduce((sum, month) => sum + month.deadCount, 0),
                daysLogged: months.reduce((sum, month) => sum + month.daysLogged, 0),
              },
      };
    });
    return {
      monthKey,
      feedKg: rows.reduce((sum, entry) => sum + (entry.row?.feedKg ?? 0), 0),
      costRm: rows.reduce((sum, entry) => sum + (entry.row?.feedCostRm ?? 0), 0),
      dead: rows.reduce((sum, entry) => sum + (entry.row?.deadCount ?? 0), 0),
      pondDays: rows.reduce((sum, entry) => sum + (entry.row?.daysLogged ?? 0), 0),
      rows,
    };
  });
  const chartData: BarDatum[] = monthly.map((month) => ({
    key: month.monthKey,
    label: fmt.month(month.monthKey),
    segments: month.rows.map((entry) => ({
      name: entry.name,
      value: entry.row?.feedKg ?? 0,
      color: entry.color,
    })),
    tooltip: {
      title: fmt.month(month.monthKey, "long"),
      lines: [
        ...month.rows
          .filter((entry) => entry.row)
          .map((entry) => ({ label: entry.name, value: formatKg(entry.row!.feedKg, 0), color: entry.color })),
        { label: t("overview.feedCost"), value: formatRm(month.costRm, 0) },
        { label: t("overview.deadFish"), value: formatNumber(month.dead, 0) },
      ],
    },
  }));

  // This month so far against last month, compared per day so a month in
  // progress isn't set against a full one.
  const dayOfMonth = Number(today.slice(8, 10));
  const lastMonthDays = daysInMonth(monthCost.lastMonth.monthKey);
  const costChange =
    monthCost.lastMonth.costRm > 0 && dayOfMonth > 0
      ? monthCost.thisMonth.costRm / dayOfMonth / (monthCost.lastMonth.costRm / lastMonthDays) - 1
      : null;
  const feedChange =
    monthCost.lastMonth.feedKg > 0 && dayOfMonth > 0
      ? monthCost.thisMonth.feedKg / dayOfMonth / (monthCost.lastMonth.feedKg / lastMonthDays) - 1
      : null;
  const loggedToday = ponds.filter(({ logs }) => logs.some((log) => log.date.toISOString().slice(0, 10) === today)).length;
  const thisMonthName = fmt.month(monthCost.thisMonth.monthKey, "long");
  const lastMonthName = fmt.month(monthCost.lastMonth.monthKey);

  return (
    <>
      <PageHeader
        eyebrow={fmt.dayKey(today, { weekday: true })}
        title={t("overview.title")}
        description={
          t("overview.description", { ponds: ponds.length, withData: withData.length }) +
          (nextHarvest
            ? nextHarvest.cycle.daysToHarvest > 0
              ? " " + t("overview.nextHarvest", { pond: nextHarvest.pond.name, n: nextHarvest.cycle.daysToHarvest })
              : " " + t("overview.pondReady", { pond: nextHarvest.pond.name })
            : "")
        }
        actions={
          <>
            <Link href="/import" className={buttonClass("secondary")}>
              <UploadIcon className="size-4" />
              {t("nav.import")}
            </Link>
            <Link href="/log" className={buttonClass("primary")}>
              <ClipboardIcon className="size-4" />
              {t("nav.dailyLog")}
            </Link>
          </>
        }
      />

      <section aria-label={t("overview.keyFigures")} className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          emphasis
          label={t("overview.standingStock")}
          value={formatNumber(totals.harvestKg, 0)}
          unit="kg"
          icon={<ScaleIcon className="size-4" />}
          sub={t("overview.standingStockSub", { boxes: estimateBoxes(totals.harvestKg, boxKg), n: withData.length })}
        />
        <SplitStatCard
          label={t("overview.feedCost")}
          halves={[
            {
              label: daily.dayKey ? fmt.dayKey(daily.dayKey) : t("overview.costThatDay"),
              value: formatRm(daily.costRm, 0),
              sub: daily.dayKey ? t("overview.pondsFed", { n: daily.ponds }) : undefined,
            },
            {
              label: thisMonthName,
              value: formatRm(monthCost.thisMonth.costRm, 0),
              change: costChange !== null ? { value: costChange, label: t("overview.dailyVs", { month: lastMonthName }), goodWhen: "down" } : null,
            },
          ]}
        />
        <StatCard
          label={t("overview.feedUsedMonth", { month: thisMonthName })}
          value={formatNumber(monthCost.thisMonth.feedKg, 0)}
          unit="kg"
          icon={<FeedIcon className="size-4" />}
          change={feedChange !== null ? { value: feedChange, label: t("overview.dailyVs", { month: lastMonthName }), goodWhen: "up" } : null}
          sub={feedChange === null ? t("overview.feedCycle", { kg: formatNumber(totals.feedKg, 0) }) : undefined}
        />
        <StatCard
          label={t("overview.deadCycle")}
          value={formatNumber(totals.dead, 0)}
          unit={t("unit.fish")}
          icon={<SkullIcon className="size-4" />}
          sub={
            totals.harvestedKg > 0
              ? t("overview.harvestedCycle", { kg: formatNumber(totals.harvestedKg, 0) })
              : monthly.at(-1)
                ? t("overview.deadInMonth", { n: formatNumber(monthly.at(-1)!.dead, 0), month: fmt.month(monthly.at(-1)!.monthKey, "long") })
                : undefined
          }
        />
      </section>

      {readyPonds.length > 0 && (
        <section
          aria-label={t("overview.readyTitle")}
          className="mb-6 rounded-lg border border-line border-l-4 bg-surface p-5 sm:p-6"
          style={{ borderLeftColor: "var(--stage-5)" }}
        >
          <div className="flex flex-wrap items-start gap-3">
            <HarvestIcon className="mt-1 size-6 shrink-0" style={{ color: "var(--stage-5)" }} />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                {t("overview.readyTitleCount", { n: readyPonds.length })}
              </h2>
              <p className="text-sm text-ink-2">{t("overview.readyDescription")}</p>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {readyPonds.slice(0, MAX_READY_CARDS).map(({ pond, metrics, timing, health, cycle }) => (
              <li key={pond.id}>
                <Link
                  href={`/ponds/${pond.id}?view=cycle`}
                  className="flex h-full flex-col rounded-md border border-line bg-surface-2 p-4 hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-semibold text-ink">{pond.name}</p>
                    {health && <HealthBadge level={health.level} />}
                  </div>
                  <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-ink">
                    ~{formatNumber(metrics.estimatedHarvestKg, 0)}
                    <span className="ml-1 text-base font-medium text-ink-3">kg</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                    <BoxIcon className="size-4 text-ink-3" />
                    {t("overview.aboutBoxes", { n: estimateBoxes(metrics.estimatedHarvestKg, boxKg), kg: boxKg })}
                  </p>
                  <p className="mt-2 text-xs font-medium" style={{ color: "var(--stage-5)" }}>
                    {timing?.atTarget
                      ? t("overview.atTarget", { abw: formatAbw(timing.latestAbwKg ?? 0) })
                      : cycle.state === "ready" && cycle.daysToHarvest < 0
                        ? t("cycle.readyPast", { n: -cycle.daysToHarvest })
                        : t("cycle.harvestToday")}
                  </p>
                  <span className={cx(buttonClass("primary", "sm"), "mt-3 self-start")}>{t("overview.recordHarvest")}</span>
                </Link>
              </li>
            ))}
          </ul>
          {readyPonds.length > MAX_READY_CARDS && (
            <Link href="/farms" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              {t("overview.readyMore", { n: readyPonds.length - MAX_READY_CARDS })}
              <ArrowRightIcon className="size-4" />
            </Link>
          )}
        </section>
      )}

      {ponds.length > MANY_PONDS ? (
        <Card className="mb-6" as="section">
          <CardHeader
            title={t("farmMap.farmsTitle")}
            description={t("farmMap.farmsDescription")}
            action={
              <Link href="/farms" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                {t("farmMap.open")}
                <ArrowRightIcon className="size-4" />
              </Link>
            }
          />
          <div className="p-5">
            <FarmSummaryGrid farms={farmGroups} />
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-6" as="section">
            <CardHeader
              icon={<MapIcon className="size-4" />}
              title={t("farmMap.title")}
              description={t("farmMap.overviewDescription")}
              action={
                <Link href="/farms" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                  {t("farmMap.open")}
                  <ArrowRightIcon className="size-4" />
                </Link>
              }
            />
            <div className="p-5">
              <FarmMap farms={farmGroups} size="sm" />
            </div>
          </Card>

          <div id="cycles" className="scroll-mt-6" />
          <Card className="mb-6" as="section">
            <CardHeader icon={<CalendarIcon className="size-4" />} title={t("overview.cyclesTitle")} description={t("overview.cyclesDescription")} />
            <div className="mt-4">
              <CycleBoard entries={ponds} forecast={forecast} today={today} />
            </div>
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Card className="flex h-full flex-col">
            <CardHeader
              icon={<ChartIcon className="size-4" />}
              title={t("overview.monthlyFeed")}
              description={t("overview.monthlyFeedDescription")}
              action={
                series.length > 1 ? (
                  <Legend items={series.map(({ name }, index) => ({ label: name, color: seriesColor(index) }))} />
                ) : undefined
              }
            />
            <div className="flex flex-1 flex-col px-3 pt-4 pb-4 sm:px-5">
              {chartData.length > 0 ? (
                <BarChart data={chartData} unit="kg" ariaLabel={t("overview.monthlyFeedAria")} height={280} fill />
              ) : (
                <EmptyState icon={<ChartIcon className="size-5" />} title={t("overview.noFeed")} description={t("overview.noFeedDescription")} />
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">{t("overview.todayLogging")}</h2>
              <Badge tone={loggedToday === ponds.length && ponds.length > 0 ? "positive" : "neutral"}>
                {t("overview.pondsCount", { done: loggedToday, total: ponds.length })}
              </Badge>
            </div>
            <div className={cx("mt-4 flex", ponds.length > MANY_PONDS ? "gap-px" : "gap-1")} aria-hidden="true">
              {ponds.map(({ pond, logs }) => {
                const done = logs.some((log) => log.date.toISOString().slice(0, 10) === today);
                return (
                  <span
                    key={pond.id}
                    title={`${pond.name}: ${done ? t("overview.logged") : t("overview.notLogged")}`}
                    className={cx("h-2 flex-1 rounded-full", done ? "bg-positive" : "bg-surface-3")}
                  />
                );
              })}
            </div>
            <p className="mt-3 text-sm text-ink-3">
              {loggedToday === 0 ? t("overview.noEntriesToday") : t("overview.entriesToday", { done: loggedToday, total: ponds.length })}
            </p>
          </Card>

          <Card>
            <CardHeader
              title={t("overview.needsAttention")}
              description={insights.length === 0 ? t("overview.nothingNeeds") : undefined}
              action={insights.length > 0 ? <Badge>{insights.length}</Badge> : undefined}
            />
            <ul className="mt-3 divide-y divide-line">
              {insights.slice(0, 4).map((insight) => (
                <InsightRow key={insight.title} insight={insight} />
              ))}
            </ul>
            {insights.length === 0 && <div className="h-4" />}
          </Card>
        </aside>
      </div>

      <Card className="mt-6">
        <CardHeader title={t("nav.ponds")} description={t("overview.pondsDescription")} />
        <nav aria-label={t("overview.filterStage")} className="mt-4 overflow-x-auto px-5">
          <ul className="flex min-w-max gap-1.5">
            {[{ key: null, label: t("overview.all"), color: null, count: ponds.length }, ...filters].map((filter) => {
              const active = filter.key === activeFilter;
              const disabled = filter.key !== null && filter.count === 0;
              return (
                <li key={filter.key ?? "all"}>
                  {disabled ? (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 text-xs text-ink-3/70">
                      {filter.label}
                    </span>
                  ) : (
                    <Link
                      href={filter.key ? `/?stage=${filter.key}` : "/"}
                      scroll={false}
                      aria-current={active ? "true" : undefined}
                      className={cx(
                        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
                        active ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                      )}
                    >
                      {filter.color && <span className="size-2 rounded-full" style={{ background: filter.color }} />}
                      {filter.label}
                      <span className="tabular-nums text-ink-3">{filter.count}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-left text-xs font-medium text-ink-3">
                <th className="px-5 py-2.5 font-medium">{t("table.pond")}</th>
                <th className="px-3 py-2.5 font-medium">{t("table.stage")}</th>
                <th className="px-3 py-2.5 font-medium">{t("table.health")}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t("table.avgWeight")}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t("table.estStock")}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t("table.costCycle")}</th>
                <th className="px-3 py-2.5 text-right font-medium">
                  <abbr title={t("table.fcrTitle")} className="no-underline">
                    FCR
                  </abbr>
                </th>
                <th className="px-3 py-2.5 text-right font-medium">{t("table.dead")}</th>
                <th className="px-3 py-2.5 font-medium">{t("table.dailyFeed60")}</th>
                <th className="px-3 py-2.5 font-medium">{t("table.lastEntry")}</th>
                <th className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {tablePonds.map(({ pond, metrics, logs, cycle, health }) => {
                const hasData = Boolean(metrics.lastLogDate);
                const recent = logs
                  .map((log) => ({ key: log.date.toISOString().slice(0, 10), kg: log.feedKg }))
                  .sort((a, b) => a.key.localeCompare(b.key))
                  .slice(-60)
                  .map((entry) => entry.kg);
                return (
                  <tr key={pond.id} className="group border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <Link href={`/ponds/${pond.id}`} className="font-semibold text-ink hover:text-brand">
                        {pond.name}
                      </Link>
                      <p className="text-xs text-ink-3">{pond.species ?? (hasData ? t("table.speciesNotSet") : t("harvestability.unset"))}</p>
                    </td>
                    <td className="px-3 py-3">
                      <StageBadge cycle={cycle} />
                      <CycleProgress cycle={cycle} today={today} />
                    </td>
                    <td className="px-3 py-3">
                      {health ? <HealthBadge level={health.level} /> : <span className="text-xs text-ink-3">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">
                      {metrics.latestSampling ? formatAbw(metrics.latestSampling.avgWeightKg) : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {hasData ? (
                        <>
                          <p className="font-medium text-ink">{formatKg(metrics.estimatedHarvestKg, 0)}</p>
                          <p className="text-xs text-ink-3">{t("unit.boxes", { n: estimateBoxes(metrics.estimatedHarvestKg, boxKg) })}</p>
                        </>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {hasData ? (
                        <>
                          <p className="text-ink">{formatRm(metrics.totals.feedCostRm, 0)}</p>
                          <p className="text-xs text-ink-3">
                            {t("table.thisMonth", { cost: formatRm(monthCost.thisMonth.byPond[pond.id] ?? 0, 0) })}
                          </p>
                        </>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <FcrValue fcr={hasData ? metrics.realizedFcr : null} target={pond.assumedFcr} />
                      {hasData && metrics.realizedFcr !== null && (
                        <p className="text-xs text-ink-3">{t("fcr.target", { target: pond.assumedFcr })}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-2">
                      {hasData ? formatNumber(metrics.totals.deadCount, 0) : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {hasData ? (
                        <Sparkline values={recent} label={t("table.sparkline", { pond: pond.name })} />
                      ) : (
                        <span className="text-xs text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {metrics.lastLogDate ? (
                        <LastEntry label={fmt.relativeDays(metrics.lastLogDate, today)} dayKey={metrics.lastLogDate} today={today} date={fmt.dayKey(metrics.lastLogDate)} />
                      ) : (
                        <Link href={`/import?pond=${pond.id}`} className="text-xs font-medium text-brand hover:underline">
                          {t("table.importHistory")}
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/ponds/${pond.id}`}
                        aria-label={t("table.open", { pond: pond.name })}
                        className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 group-hover:text-ink"
                      >
                        <ChevronRightIcon className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tablePonds.length < filteredPonds.length && (
          <Link
            href={activeFilter ? `/?stage=${activeFilter}&all=1` : "/?all=1"}
            scroll={false}
            className="flex items-center justify-center gap-1 border-t border-line px-5 py-3 text-sm font-medium text-brand hover:bg-surface-2"
          >
            {t("overview.showAllPonds", { n: filteredPonds.length })}
            <ArrowRightIcon className="size-4" />
          </Link>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title={t("overview.recentEntries")} description={t("overview.recentDescription")} />
        {activity.length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("overview.recentEmpty")}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 border-t border-line sm:grid-cols-2 xl:grid-cols-3">
            {activity.map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-3 border-b border-line px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {log.pond.name}
                    <span className="font-normal text-ink-3"> · {fmt.day(log.date, { year: false })}</span>
                  </p>
                  <p className="truncate text-ink-3">
                    {log.bags > 0 ? `${log.feedType?.code} ${fmt.bags(log.bags)}` : t("log.noFeeding")} ·{" "}
                    {t("log.deadCount", { n: log.deadCount })}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-3">{log.recordedBy ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function LastEntry({ label, dayKey, today, date }: { label: string; dayKey: string; today: string; date: string }) {
  const stale = daysBetween(dayKey, today) > 1;
  return (
    <div>
      <p className={cx("font-medium", stale ? "text-warning" : "text-ink")}>{label.charAt(0).toUpperCase() + label.slice(1)}</p>
      <p className="text-xs text-ink-3">{date}</p>
    </div>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const Icon = insight.severity === "info" ? InfoIcon : AlertIcon;
  const tone =
    insight.severity === "critical"
      ? "bg-danger-soft text-danger"
      : insight.severity === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-info-soft text-info";
  const content = (
    <>
      <span className={cx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{insight.title}</span>
        <span className="mt-0.5 block text-pretty text-xs leading-5 text-ink-3">{insight.detail}</span>
      </span>
      {insight.href && <ArrowRightIcon className="mt-1 size-4 shrink-0 text-ink-3" />}
    </>
  );
  return (
    <li>
      {insight.href ? (
        <Link href={insight.href} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2">
          {content}
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-5 py-3.5">{content}</div>
      )}
    </li>
  );
}
