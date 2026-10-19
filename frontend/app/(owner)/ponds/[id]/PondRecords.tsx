"use client";

import Link from "next/link";
import type { getFeedTypes, getPondDetail } from "@backend/lib/queries";
import { dateToDayKey, daysInMonth, monthKeyOf } from "@fisheye/shared/dates";
import { formatNumber, formatRm } from "@fisheye/shared/format";
import { PencilIcon, PlusIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, cx, feedColor } from "@/app/components/ui";
import { deleteDailyLog } from "@/lib/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import { useI18n } from "@/app/components/I18nProvider";

type Detail = NonNullable<Awaited<ReturnType<typeof getPondDetail>>>;
type FeedTypes = Awaited<ReturnType<typeof getFeedTypes>>;

export default function PondRecords({
  detail,
  feedTypes,
  month: requestedMonth,
  today,
}: {
  detail: Detail;
  feedTypes: FeedTypes;
  month?: string;
  today: string;
}) {
  const { t, fmt } = useI18n();
  const { pond, allLogs: logs, metrics } = detail;
  const currentMonth = today.slice(0, 7);
  // Includes months from earlier cycles so their records stay reachable.
  const months = [...new Set([...logs.map((log) => monthKeyOf(log.date)), currentMonth])].sort();
  const month =
    requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : (metrics.months.at(-1)?.monthKey ?? currentMonth);
  const summary = metrics.months.find((row) => row.monthKey === month);
  const monthLogs = new Map(
    logs.filter((log) => monthKeyOf(log.date) === month).map((log) => [dateToDayKey(log.date), log]),
  );
  const dayCount = daysInMonth(month);
  const lastDay = month === currentMonth ? Number(today.slice(8, 10)) : dayCount;
  const feedTypeById = new Map(feedTypes.map((feedType) => [feedType.id, feedType]));
  const returnTo = `/ponds/${pond.id}?view=records&month=${month}`;

  const byType = new Map<number, { bags: number; kg: number; cost: number }>();
  for (const log of monthLogs.values()) {
    if (!log.feedTypeId || log.bags <= 0) continue;
    const entry = byType.get(log.feedTypeId) ?? { bags: 0, kg: 0, cost: 0 };
    entry.bags += log.bags;
    entry.kg += log.feedKg;
    entry.cost += log.feedCostRm;
    byType.set(log.feedTypeId, entry);
  }

  return (
    <div className="space-y-6">
      <nav aria-label={t("pond.col.month")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5">
          {months.map((key) => (
            <li key={key}>
              <Link
                href={`/ponds/${pond.id}?view=records&month=${key}`}
                scroll={false}
                aria-current={key === month ? "page" : undefined}
                className={cx(
                  "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium",
                  key === month
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
              >
                {fmt.month(key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title={fmt.month(month, "long")}
            description={
              summary
                ? t("records.daysRecorded", { done: summary.daysLogged, total: lastDay }) +
                  (summary.cultureMonth !== null ? ` · ${t("records.cultureMonth", { n: summary.cultureMonth })}` : "")
                : t("records.none")
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm tabular-nums">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-xs font-medium text-ink-3">
                  <th className="px-5 py-2.5 font-medium">{t("harvests.col.date")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("pond.col.feedType")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("pond.col.bags")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("pond.col.feed")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("pond.col.cost")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("table.dead")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("records.recorded")}</th>
                  <th className="w-24 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: lastDay }, (_, index) => {
                  const dayKey = `${month}-${String(index + 1).padStart(2, "0")}`;
                  const log = monthLogs.get(dayKey);
                  const editHref = `/log/${pond.id}?date=${dayKey}&returnTo=${encodeURIComponent(returnTo)}`;
                  return (
                    <tr
                      key={dayKey}
                      className={cx("border-b border-line last:border-0", log ? "hover:bg-surface-2" : "bg-surface-2/40")}
                    >
                      <td className="px-5 py-2 whitespace-nowrap text-ink-2">
                        {fmt.dayKey(dayKey, { weekday: true, year: false })}
                      </td>
                      {log ? (
                        <>
                          <td className="px-3 py-2">
                            {log.feedType && log.bags > 0 ? (
                              <span className="inline-flex items-center gap-2 font-medium text-ink">
                                <span className="size-2 rounded-[2px]" style={{ background: feedColor(log.feedTypeId) }} />
                                {log.feedType.code}
                              </span>
                            ) : (
                              <span className="text-ink-3">{t("log.noFeeding")}</span>
                            )}
                            {log.note && <p className="max-w-56 truncate text-xs text-ink-3" title={log.note}>{log.note}</p>}
                          </td>
                          <td className="px-3 py-2 text-right text-ink">{log.bags > 0 ? formatNumber(log.bags, 1) : "—"}</td>
                          <td className="px-3 py-2 text-right text-ink-2">{log.feedKg > 0 ? formatNumber(log.feedKg, 0) : "—"}</td>
                          <td className="px-3 py-2 text-right text-ink-2">{log.feedCostRm > 0 ? formatRm(log.feedCostRm) : "—"}</td>
                          <td className={cx("px-3 py-2 text-right", log.deadCount > 0 ? "font-medium text-danger" : "text-ink-3")}>
                            {log.deadCount}
                          </td>
                          <td className="px-3 py-2">
                            {log.source === "import" ? (
                              <Badge>{t("records.spreadsheet")}</Badge>
                            ) : (
                              <Badge tone="brand">{log.recordedBy ?? t("records.app")}</Badge>
                            )}
                          </td>
                          <td className="px-5 py-2">
                            <div className="flex justify-end gap-1">
                              <Link
                                href={editHref}
                                className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink"
                                aria-label={t("records.editDay", { date: dayKey })}
                              >
                                <PencilIcon className="size-4" />
                              </Link>
                              <ConfirmButton
                                action={deleteDailyLog}
                                fields={{ id: String(log.id) }}
                                message={t("records.deleteConfirm", { date: fmt.day(log.date) })}
                                label={t("records.deleteDay", { date: dayKey })}
                              />
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td colSpan={6} className="px-3 py-2 text-xs text-ink-3">
                            {t("pond.notRecorded")}
                          </td>
                          <td className="px-5 py-2 text-right">
                            <Link
                              href={editHref}
                              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-brand hover:bg-brand-soft"
                            >
                              <PlusIcon className="size-3.5" />
                              {t("form.add")}
                            </Link>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {summary && (
                <tfoot>
                  <tr className="bg-surface-2 font-semibold text-ink">
                    <td className="px-5 py-3">{t("records.total")}</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right">{formatNumber(summary.bags, 1)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(summary.feedKg, 0)}</td>
                    <td className="px-3 py-3 text-right">{formatRm(summary.feedCostRm)}</td>
                    <td className="px-3 py-3 text-right">{summary.deadCount}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("records.breakdown")} description={t("records.breakdownDescription")} />
            {byType.size === 0 ? (
              <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("records.noFeed")}</p>
            ) : (
              <table className="mt-4 w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-right text-xs text-ink-3">
                    <th className="px-5 py-2 text-left font-medium">{t("records.type")}</th>
                    <th className="px-2 py-2 font-medium">{t("pond.col.bags")}</th>
                    <th className="px-2 py-2 font-medium">kg</th>
                    <th className="px-5 py-2 font-medium">{t("pond.col.cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byType.entries()].map(([feedTypeId, entry]) => (
                    <tr key={feedTypeId} className="border-b border-line text-right text-ink-2 last:border-0">
                      <td className="px-5 py-2 text-left">
                        <span className="inline-flex items-center gap-2 font-medium text-ink">
                          <span className="size-2 rounded-[2px]" style={{ background: feedColor(feedTypeId) }} />
                          {feedTypeById.get(feedTypeId)?.code}
                        </span>
                        <span className="block text-xs text-ink-3">
                          {entry.kg > 0 ? `${formatRm(entry.cost / entry.kg)}/kg` : ""}
                        </span>
                      </td>
                      <td className="px-2 py-2">{formatNumber(entry.bags, 1)}</td>
                      <td className="px-2 py-2">{formatNumber(entry.kg, 0)}</td>
                      <td className="px-5 py-2 text-ink">{formatRm(entry.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {summary && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold text-ink">{t("records.summary")}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <Stat label={t("entry.feed")} value={`${formatNumber(summary.feedKg, 0)} kg`} />
                <Stat label={t("pond.col.cost")} value={formatRm(summary.feedCostRm, 0)} />
                <Stat label={t("overview.deadFish")} value={String(summary.deadCount)} />
                <Stat label={t("pond.col.deadKg")} value={`${formatNumber(summary.deadKg, 2)} kg`} />
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
