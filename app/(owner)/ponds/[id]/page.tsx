import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateToDayKey, todayKey } from "@/lib/dates";
import { suggestStocking } from "@/lib/cycle";
import { formatAbw, formatNumber } from "@/lib/format";
import { estimateBoxes } from "@/lib/harvest";
import { getI18n } from "@/lib/i18n/server";
import { getFarms, getFeedTypes, getPondDetail, getPondsWithMetrics, getSizeGrades } from "@/lib/queries";
import { getBoxKg } from "@/lib/settings";
import { CycleStepper, StageBadge } from "@/app/components/cycle";
import { HealthBadge } from "@/app/components/harvest";
import { BoxIcon, ClipboardIcon, DownloadIcon, HarvestIcon } from "@/app/components/icons";
import { Badge, PageHeader, Tabs, buttonClass, cx } from "@/app/components/ui";
import PondOverview from "./PondOverview";
import PondRecords from "./PondRecords";
import PondData from "./PondData";
import PondSettingsForm from "./PondSettingsForm";
import PondCycle from "./PondCycle";

export const dynamic = "force-dynamic";

const VIEWS = ["overview", "cycle", "records", "data", "settings"] as const;
type View = (typeof VIEWS)[number];

export async function generateMetadata({ params }: PageProps<"/ponds/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const detail = Number.isInteger(id) ? await getPondDetail(id) : null;
  return { title: detail?.pond.name ?? "Pond" };
}

export default async function PondPage({ params, searchParams }: PageProps<"/ponds/[id]">) {
  const pondId = Number((await params).id);
  if (!Number.isInteger(pondId)) notFound();
  const query = await searchParams;
  const today = todayKey();
  const { t, fmt } = await getI18n();

  const [detail, feedTypes, boxKg] = await Promise.all([getPondDetail(pondId, today), getFeedTypes(), getBoxKg()]);
  if (!detail) notFound();

  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "overview";
  const { pond, metrics, cycle, timing, health } = detail;
  const running = cycle.state === "growing" || cycle.state === "ready";
  const ready = detail.harvestability === "ready";
  const warningCount = detail.imports.reduce(
    (sum, batch) => sum + batch.findings.filter((finding) => finding.severity === "warning").length,
    0,
  );
  const base = `/ponds/${pond.id}`;

  return (
    <>
      <nav className="mb-3 text-sm text-ink-3" aria-label={t("nav.breadcrumb")}>
        <Link href="/" className="hover:text-ink">
          {t("nav.overview")}
        </Link>
        {detail.farm && (
          <>
            <span className="mx-1.5">/</span>
            <Link href="/farms" className="hover:text-ink">
              {detail.farm.name}
            </Link>
          </>
        )}
        <span className="mx-1.5">/</span>
        <span className="text-ink-2">{pond.name}</span>
      </nav>

      <PageHeader
        title={pond.name}
        meta={
          <>
            {pond.species && <Badge tone="brand">{pond.species}</Badge>}
            {cycle.state === "unset" ? <Badge tone="warning">{t("cycle.stockingNotSet")}</Badge> : <StageBadge cycle={cycle} />}
            {health && <HealthBadge level={health.level} />}
            {metrics.stockedAt && <Badge>{t("pond.stockedOn", { date: fmt.dayKey(metrics.stockedAt) })}</Badge>}
            {metrics.currentFeedCode && <Badge>{t("pond.feeding", { code: metrics.currentFeedCode })}</Badge>}
          </>
        }
        actions={
          <>
            {metrics.lastLogDate && (
              <a href={`${base}/export`} className={buttonClass("secondary")}>
                <DownloadIcon className="size-4" />
                {t("pond.exportCsv")}
              </a>
            )}
            <Link href={`/log/${pond.id}?returnTo=${encodeURIComponent(`${base}?view=records`)}`} className={buttonClass("primary")}>
              <ClipboardIcon className="size-4" />
              {t("pond.logToday")}
            </Link>
          </>
        }
      />

      {ready && running && (
        <section
          className="mb-6 flex flex-col gap-4 rounded-lg border border-line border-l-4 bg-surface p-4 sm:p-6 lg:flex-row lg:items-center"
          style={{ borderLeftColor: "var(--stage-5)" }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <HarvestIcon className="mt-1 size-7 shrink-0" style={{ color: "var(--stage-5)" }} />
            <div className="min-w-0">
              <p className="text-xl font-semibold tracking-tight text-ink sm:text-3xl">{t("stage.ready")}</p>
              <p className="mt-0.5 text-sm text-ink-2">
                {timing?.atTarget
                  ? t("pond.readyAtTarget", { abw: formatAbw(timing.latestAbwKg ?? 0), target: formatAbw(timing.targetKg ?? 0) })
                  : cycle.daysToHarvest < 0
                    ? t("pond.readyPast", { n: -cycle.daysToHarvest, date: fmt.dayKey(cycle.plannedHarvestAt) })
                    : t("insight.ready.today")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 lg:border-0 lg:pt-0">
            <div className="lg:text-right">
              <p className="text-3xl font-semibold tabular-nums text-ink">
                ~{formatNumber(metrics.estimatedHarvestKg, 0)}
                <span className="ml-1 text-base font-medium text-ink-3">kg</span>
              </p>
              <p className="flex items-center gap-1.5 text-sm text-ink-2 lg:justify-end">
                <BoxIcon className="size-4 text-ink-3" />
                {t("overview.aboutBoxes", { n: estimateBoxes(metrics.estimatedHarvestKg, boxKg), kg: boxKg })}
              </p>
            </div>
            {view !== "cycle" && (
              <Link href={`${base}?view=cycle`} scroll={false} className={buttonClass("primary", "lg")}>
                {t("overview.recordHarvest")}
              </Link>
            )}
          </div>
        </section>
      )}

      <CycleStepper
        cycle={cycle}
        cycleMonths={pond.cycleMonths}
        today={today}
        fcr={metrics.realizedFcr}
        targetFcr={pond.assumedFcr}
        action={
          view !== "cycle" &&
          !ready && (
            <Link href={`${base}?view=cycle`} scroll={false} className={cx(buttonClass("secondary", "sm"))}>
              {t("pond.harvestOrLoss")}
            </Link>
          )
        }
      />

      <Tabs
        active={view}
        label={t("nav.sections")}
        items={[
          { key: "overview", label: t("pond.tab.overview"), href: base },
          {
            key: "cycle",
            label: running ? t("pond.tab.cycle") : t("pond.tab.cycleEmpty"),
            href: `${base}?view=cycle`,
            count: detail.harvests.length || undefined,
          },
          { key: "records", label: t("pond.tab.records"), href: `${base}?view=records`, count: metrics.totals.daysLogged },
          { key: "data", label: t("pond.tab.data"), href: `${base}?view=data`, count: warningCount || undefined },
          { key: "settings", label: t("pond.tab.settings"), href: `${base}?view=settings` },
        ]}
      />

      {view === "overview" && <PondOverview detail={detail} feedTypes={feedTypes} boxKg={boxKg} today={today} />}
      {view === "cycle" && (
        <PondCycle
          detail={detail}
          today={today}
          boxKg={boxKg}
          grades={await getSizeGrades({ activeOnly: true })}
          suggestion={running ? null : await stockingSuggestion(pond.id, pond.cycleMonths, today)}
        />
      )}
      {view === "records" && (
        <PondRecords
          detail={detail}
          feedTypes={feedTypes}
          month={typeof query.month === "string" ? query.month : undefined}
          today={today}
        />
      )}
      {view === "data" && <PondData detail={detail} />}
      {view === "settings" && (
        <PondSettingsForm
          today={today}
          farms={(await getFarms()).map((farm) => ({ id: farm.id, name: farm.name }))}
          specs={{
            id: pond.id,
            areaM2: pond.areaM2,
            depthM: pond.depthM,
            pondType: pond.pondType,
            waterSource: pond.waterSource,
            aerators: pond.aerators,
            waterStatus: pond.waterStatus,
            waterNote: pond.waterNote,
            waterCheckedAt: pond.waterCheckedAt ? dateToDayKey(pond.waterCheckedAt) : null,
          }}
          pond={{
            id: pond.id,
            name: pond.name,
            species: pond.species,
            farmId: pond.farmId,
            stockedAt: metrics.stockedAt,
            stockedCount: pond.stockedCount,
            assumedFcr: pond.assumedFcr,
            cycleMonths: pond.cycleMonths,
            targetWeightKg: pond.targetWeightKg,
            active: pond.active,
          }}
        />
      )}
    </>
  );
}

// "Stock in Oct to harvest Jun 27, when no other pond is planned."
async function stockingSuggestion(pondId: number, cycleMonths: number, today: string) {
  const { t, fmt } = await getI18n();
  const others = (await getPondsWithMetrics(today)).filter((entry) => entry.pond.id !== pondId);
  if (!others.some(({ cycle }) => cycle.state === "growing" || cycle.state === "ready")) return null;
  const best = suggestStocking(others, cycleMonths, today);
  const when = best.stockMonth === today.slice(0, 7) ? t("suggest.thisMonth") : t("suggest.inMonth", { month: fmt.month(best.stockMonth, "long") });
  const clash =
    best.others.length === 0
      ? t("suggest.noClash")
      : t("suggest.alongside", { ponds: best.others.map((pond) => pond.name).join(", ") });
  return t("suggest.text", { when, month: fmt.month(best.harvestMonth, "long"), clash });
}
