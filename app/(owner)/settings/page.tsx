import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dateToDayKey } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { getBoxKg } from "@/lib/settings";
import { getAuthClient } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { signOutEverywhere } from "@/app/actions/session";
import { BoxIcon, ChevronRightIcon, FeedIcon, FishIcon, MapIcon, UserIcon, WavesIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, PageHeader } from "@/app/components/ui";
import { BoxKgForm, FarmRow, FeedTypeRow, GradeRow, NewFarmForm, NewFeedTypeForm, NewGradeForm, NewPondForm, NewUserForm, UserRow } from "./SettingsForms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("nav.settings") };
}

export default async function SettingsPage() {
  const { t, fmt } = await getI18n();
  const [me, ponds, feedTypes, farms, grades, boxKg, users] = await Promise.all([
    requireOwner(),
    prisma.pond.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { dailyLogs: true } }, farm: { select: { name: true } } },
    }),
    prisma.feedType.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { dailyLogs: true } } } }),
    prisma.farm.findMany({ orderBy: { id: "asc" }, include: { _count: { select: { ponds: true } } } }),
    prisma.sizeGrade.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { _count: { select: { lines: true } } } }),
    getBoxKg(),
    getAuthClient().user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
  ]);

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

          <Card>
            <CardHeader icon={<UserIcon className="size-4" />} title={t("users.title")} description={t("users.description")} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-3">
                    <th className="px-5 py-2.5 font-medium">{t("users.name")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("users.role")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("users.password")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("settings.active")}</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={{
                        id: user.id,
                        name: user.name,
                        username: user.username,
                        role: user.role === "owner" ? "owner" : "worker",
                        active: user.active,
                        isMe: user.id === me.userId,
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <NewUserForm />
            <form action={signOutEverywhere} className="border-t border-line px-5 py-3">
              <button type="submit" className="text-sm font-medium text-ink-2 underline-offset-2 hover:underline">
                {t("users.signOutEverywhere")}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
