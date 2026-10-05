"use client";

import Link from "next/link";
import { MANY_PONDS, buildFarmGroups } from "@/lib/farmMap";
import { formatAbw, formatNumber } from "@fisheye/shared/format";
import { estimateBoxes } from "@fisheye/shared/harvest";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { farmMapData } from "@backend/lib/pages";
import { FarmMap, FarmSummaryGrid, HARVESTABILITY, HARVESTABILITY_ORDER, HarvestabilityBadge, HealthBadge } from "@/app/components/harvest";
import { CalendarIcon, MapIcon, SettingsIcon } from "@/app/components/icons";
import { Card, CardHeader, EmptyState, PageHeader, buttonClass, cx } from "@/app/components/ui";

const QUEUE_LIMIT = 20;

type FarmMapData = Awaited<ReturnType<typeof farmMapData>>;

export default function FarmsPage() {
  return <Api<FarmMapData> path="/farm-map">{(data) => <Farms data={data} />}</Api>;
}

function Farms({ data }: { data: FarmMapData }) {
  const { today, ponds, farms, boxKg } = data;
  const { t, fmt } = useI18n();
  useTitle(t("farmMap.title"));
  const groups = buildFarmGroups(ponds, farms, boxKg, t("farmMap.unassigned"));

  // Running ponds in the order they need harvesting.
  const queue = ponds
    .filter((entry) => entry.timing)
    .sort((a, b) => a.timing!.harvestBy.localeCompare(b.timing!.harvestBy))
    // With many ponds, only the next ones due; each farm page has the rest.
    .slice(0, ponds.length > MANY_PONDS ? QUEUE_LIMIT : undefined);

  return (
    <>
      <PageHeader
        eyebrow={fmt.dayKey(today, { weekday: true })}
        title={t("farmMap.title")}
        description={t("farmMap.pageDescription")}
        actions={
          <Link href="/settings#farms" className={buttonClass("secondary")}>
            <SettingsIcon className="size-4" />
            {t("farmMap.manage")}
          </Link>
        }
      />

      <section aria-label={t("farmMap.summary")} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {HARVESTABILITY_ORDER.filter((status) => status !== "unset").map((status) => {
          const count = ponds.filter((entry) => entry.harvestability === status).length;
          return (
            <Card key={status} as="div" className="p-4">
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <span className="size-2.5 rounded-full" style={{ background: HARVESTABILITY[status].color }} />
                {t(`harvestability.${status}`)}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{count}</p>
            </Card>
          );
        })}
      </section>

      <Card className="mb-6">
        <CardHeader icon={<MapIcon className="size-4" />} title={t("farmMap.byFarm")} description={t("farmMap.byFarmDescription")} />
        <div className="p-5">
          {ponds.length === 0 ? (
            <EmptyState title={t("farmMap.noPondsAtAll")} description={t("farmMap.noPondsAtAllDescription")} />
          ) : ponds.length > MANY_PONDS ? (
            <FarmSummaryGrid farms={groups} />
          ) : (
            <FarmMap farms={groups} />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader icon={<CalendarIcon className="size-4" />} title={t("farmMap.queueTitle")} description={t("farmMap.queueDescription")} />
        {queue.length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("farmMap.queueEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-3">
                  <th className="px-5 py-2.5 font-medium">{t("table.pond")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("farmMap.farm")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("farmMap.status")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("table.health")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("timing.harvestBy")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("table.avgWeight")}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t("table.estStock")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(({ pond, farm, timing, health, harvestability, metrics }) => (
                  <tr key={pond.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <Link href={`/ponds/${pond.id}`} className="font-semibold text-ink hover:text-brand">
                        {pond.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{farm?.name ?? t("farmMap.unassigned")}</td>
                    <td className="px-3 py-3">
                      <HarvestabilityBadge status={harvestability} />
                    </td>
                    <td className="px-3 py-3">{health ? <HealthBadge level={health.level} /> : "—"}</td>
                    <td className="px-3 py-3">
                      <p className={cx("font-medium", timing!.daysLeft <= 0 ? "text-danger" : "text-ink")}>
                        {fmt.dayKey(timing!.harvestBy)}
                      </p>
                      <p className="text-xs text-ink-3">
                        {timing!.daysLeft > 0 ? t("time.inDays", { n: timing!.daysLeft }) : t("timing.now")}
                        {timing!.projectedAt && timing!.harvestBy === timing!.projectedAt ? ` · ${t("timing.byTargetSize")}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {metrics.latestSampling ? formatAbw(metrics.latestSampling.avgWeightKg) : "—"}
                      {timing!.targetKg && <p className="text-xs text-ink-3">{t("timing.targetShort", { abw: formatAbw(timing!.targetKg) })}</p>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <p className="font-medium text-ink">{formatNumber(metrics.estimatedHarvestKg, 0)} kg</p>
                      <p className="text-xs text-ink-3">{t("unit.boxes", { n: estimateBoxes(metrics.estimatedHarvestKg, boxKg) })}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
