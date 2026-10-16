"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { harvestForecast } from "@fisheye/shared/cycle";
import { buildFarmGroups } from "@/lib/farmMap";
import { formatNumber } from "@fisheye/shared/format";
import { estimateBoxes } from "@fisheye/shared/harvest";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { farmMapData } from "@backend/lib/pages";
import { CycleBoard } from "@/app/components/cycle";
import { FarmMap, HARVESTABILITY, HARVESTABILITY_ORDER } from "@/app/components/harvest";
import { ChevronLeftIcon } from "@/app/components/icons";
import { Card, CardHeader, EmptyState, PageHeader } from "@/app/components/ui";

type FarmMapData = Awaited<ReturnType<typeof farmMapData>>;

export default function FarmPage() {
  return <Api<FarmMapData> path="/farm-map">{(data) => <Farm data={data} />}</Api>;
}

// One farm on its own: its ponds as a map, then their cycles on a timeline.
function Farm({ data }: { data: FarmMapData }) {
  const id = Number(useParams<{ id: string }>().id);
  const { today, ponds: allPonds, farms, boxKg } = data;
  const { t, fmt } = useI18n();
  const farm = farms.find((entry) => entry.id === id);
  useTitle(farm?.name ?? t("farmMap.title"));
  if (!farm) notFound();

  const ponds = allPonds.filter((entry) => entry.farm?.id === id);
  const [group] = buildFarmGroups(ponds, [farm], boxKg, t("farmMap.unassigned"));
  const standingKg = ponds.reduce((sum, entry) => sum + entry.metrics.estimatedHarvestKg, 0);

  return (
    <>
      <Link
        href="/farms"
        className="mb-3 inline-flex h-8 items-center gap-1 pr-2 text-sm font-medium text-ink-2 hover:text-ink"
      >
        <ChevronLeftIcon className="size-4" />
        {t("farm.allFarms")}
      </Link>
      <PageHeader
        eyebrow={fmt.dayKey(today, { weekday: true })}
        title={farm.name}
        description={t("farm.description", { n: ponds.length })}
      />

      <section aria-label={t("farmMap.summary")} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <Card as="div" className="col-span-2 p-4 sm:col-span-3 xl:col-span-2">
          <p className="text-sm text-ink-2">{t("farm.standingStock")}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
            {formatNumber(standingKg, 0)}
            <span className="ml-1 text-sm font-medium text-ink-3">kg</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-3">{t("unit.boxes", { n: estimateBoxes(standingKg, boxKg) })}</p>
        </Card>
        {HARVESTABILITY_ORDER.filter((status) => status !== "unset").map((status) => (
          <Card key={status} as="div" className="p-4">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <span className="size-2.5 rounded-full" style={{ background: HARVESTABILITY[status].color }} />
              {t(`harvestability.${status}`)}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {ponds.filter((entry) => entry.harvestability === status).length}
            </p>
          </Card>
        ))}
      </section>

      <Card className="mb-6">
        <CardHeader title={t("farm.mapTitle")} description={t("farmMap.byFarmDescription")} />
        <div className="p-5">
          {ponds.length === 0 ? (
            <EmptyState title={t("farmMap.noPonds")} description={t("farmMap.noPondsAtAllDescription")} />
          ) : (
            <FarmMap farms={[{ ...group, name: "" }]} />
          )}
        </div>
      </Card>

      {ponds.length > 0 && (
        <Card as="section">
          <CardHeader title={t("overview.cyclesTitle")} description={t("farm.cyclesDescription")} />
          <div className="mt-4">
            <CycleBoard entries={ponds} forecast={harvestForecast(ponds, today)} today={today} />
          </div>
        </Card>
      )}
    </>
  );
}
