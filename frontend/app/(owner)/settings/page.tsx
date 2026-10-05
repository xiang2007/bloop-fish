"use client";

import Link from "next/link";
import { dateToDayKey } from "@fisheye/shared/dates";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { settingsData } from "@backend/lib/pages";
import { BoxIcon, ChevronRightIcon, FeedIcon, FishIcon, MapIcon, WavesIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, PageHeader } from "@/app/components/ui";
import { BoxKgForm, FarmRow, FeedTypeRow, GradeRow, NewFarmForm, NewFeedTypeForm, NewGradeForm, NewPondForm } from "./SettingsForms";

type SettingsData = Awaited<ReturnType<typeof settingsData>>;

export default function SettingsPage() {
  return <Api<SettingsData> path="/settings">{(data) => <Settings data={data} />}</Api>;
}

function Settings({ data }: { data: SettingsData }) {
  const { ponds, feedTypes, farms, grades, boxKg } = data;
  const { t, fmt } = useI18n();
  useTitle(t("nav.settings"));

  return (
    <>
      <PageHeader eyebrow={t("settings.eyebrow")} title={t("nav.settings")} description={t("settings.description")} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<FeedIcon className="size-4" />} title={t("settings.feedTitle")} description={t("settings.feedDescription")} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-3">
                  <th className="px-5 py-2.5 font-medium">{t("settings.code")}</th>
                  <th className="px-2 py-2.5 font-medium">{t("settings.bagKg")}</th>
                  <th className="px-2 py-2.5 font-medium">{t("settings.rmKg")}</th>
                  <th className="px-2 py-2.5 font-medium">{t("settings.active")}</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {feedTypes.map((feedType) => (
                  <FeedTypeRow
                    key={feedType.id}
                    feedType={{
                      id: feedType.id,
                      code: feedType.code,
                      packSizeKg: feedType.packSizeKg,
                      pricePerKg: feedType.pricePerKg,
                      active: feedType.active,
                      uses: feedType._count.dailyLogs,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <NewFeedTypeForm />
        </Card>

        <Card>
          <CardHeader icon={<WavesIcon className="size-4" />} title={t("nav.ponds")} description={t("settings.pondsDescription")} />
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {ponds.map((pond) => (
              <li key={pond.id}>
                <Link href={`/ponds/${pond.id}?view=settings`} className="flex items-center gap-4 px-5 py-3 text-sm hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{pond.name}</p>
                    <p className="text-ink-3">
                      {[
                        pond.farm?.name,
                        pond.species,
                        pond.stockedAt ? t("settings.stocked", { date: fmt.dayKey(dateToDayKey(pond.stockedAt)) }) : t("settings.notStocked"),
                        t("settings.records", { n: pond._count.dailyLogs }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {!pond.active && <Badge>{t("settings.inactive")}</Badge>}
                  <ChevronRightIcon className="size-4 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
          <NewPondForm farms={farms.map((farm) => ({ id: farm.id, name: farm.name }))} />
        </Card>

        <Card>
          <div id="farms" className="scroll-mt-6" />
          <CardHeader icon={<MapIcon className="size-4" />} title={t("settings.farmsTitle")} description={t("settings.farmsDescription")} />
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {farms.length === 0 && <li className="px-5 py-3 text-sm text-ink-3">{t("settings.noFarms")}</li>}
            {farms.map((farm) => (
              <FarmRow key={farm.id} farm={{ id: farm.id, name: farm.name, ponds: farm._count.ponds }} />
            ))}
          </ul>
          <NewFarmForm />
        </Card>

        <div className="space-y-6">
          <Card>
            <div id="grades" className="scroll-mt-6" />
            <CardHeader icon={<FishIcon className="size-4" />} title={t("settings.gradesTitle")} description={t("settings.gradesDescription")} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-3">
                    <th className="px-5 py-2.5 font-medium">{t("settings.gradeName")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("settings.minKg")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("settings.maxKg")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("settings.order")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("settings.active")}</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade) => (
                    <GradeRow
                      key={grade.id}
                      grade={{
                        id: grade.id,
                        label: grade.label,
                        minKg: grade.minKg,
                        maxKg: grade.maxKg,
                        sortOrder: grade.sortOrder,
                        active: grade.active,
                        uses: grade._count.lines,
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <NewGradeForm />
          </Card>

          <Card>
            <CardHeader icon={<BoxIcon className="size-4" />} title={t("settings.boxTitle")} description={t("settings.boxDescription")} />
            <BoxKgForm boxKg={boxKg} />
          </Card>
        </div>
      </div>
    </>
  );
}
