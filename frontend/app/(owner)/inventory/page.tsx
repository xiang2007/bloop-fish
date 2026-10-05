"use client";

import { todayKey } from "@fisheye/shared/dates";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { inventoryData } from "@backend/lib/pages";
import { formatKg, formatNumber, formatRm } from "@fisheye/shared/format";
import { LOW_STOCK_DAYS, USAGE_WINDOW_DAYS } from "@fisheye/shared/inventory";
import { deleteStockMovement } from "@/lib/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import { PackageIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, EmptyState, PageHeader, cx, feedColor } from "@/app/components/ui";
import StockMovementForm from "./StockMovementForm";

type InventoryData = Awaited<ReturnType<typeof inventoryData>>;

export default function InventoryPage() {
  return <Api<InventoryData> path="/inventory">{(data) => <Inventory data={data} />}</Api>;
}

function Inventory({ data }: { data: InventoryData }) {
  const { levels, horizon } = data.stock;
  const { movements } = data;
  const { t, fmt } = useI18n();
  useTitle(t("nav.feedStock"));
  const today = todayKey();

  const tracked = levels.filter((level) => level.onHandBags !== null);
  const stockValue = tracked.reduce(
    (sum, level) => sum + Math.max(level.onHandBags ?? 0, 0) * level.feedType.packSizeKg * level.feedType.pricePerKg,
    0,
  );
  const inUse = levels.filter((level) => level.avgDailyBags > 0 || level.onHandBags !== null);
  const idle = levels.filter((level) => !inUse.includes(level));

  return (
    <>
      <PageHeader
        eyebrow={t("nav.operations")}
        title={t("nav.feedStock")}
        description={t("stock.description", { n: USAGE_WINDOW_DAYS, date: fmt.dayKey(horizon) })}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              icon={<PackageIcon className="size-4" />}
              title={t("stock.byType")}
              description={
                tracked.length > 0
                  ? t("stock.counted", { done: tracked.length, total: levels.length, value: formatRm(stockValue, 0) })
                  : t("stock.noneCounted")
              }
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm tabular-nums">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-right text-xs font-medium text-ink-3">
                    <th className="px-5 py-2.5 text-left font-medium">{t("pond.col.feedType")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stock.onHand")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("stock.usePerDay")}</th>
                    <th className="px-3 py-2.5 text-left font-medium">{t("stock.cover")}</th>
                    <th className="px-5 py-2.5 text-left font-medium">{t("stock.lastCount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...inUse, ...idle].map((level) => {
                    const cover = level.daysOfCover;
                    const tone = cover === null ? null : cover < 3 ? "danger" : cover < LOW_STOCK_DAYS ? "warning" : "positive";
                    return (
                      <tr
                        key={level.feedType.id}
                        className={cx("border-b border-line text-right last:border-0", !level.feedType.active && "opacity-60")}
                      >
                        <td className="px-5 py-3 text-left">
                          <span className="inline-flex items-center gap-2 font-semibold text-ink">
                            <span className="size-2.5 rounded-[3px]" style={{ background: feedColor(level.feedType.id) }} />
                            {level.feedType.code}
                          </span>
                          <span className="block text-xs text-ink-3">{t("stock.bagSize", { kg: level.feedType.packSizeKg })}</span>
                        </td>
                        <td className="px-3 py-3">
                          {level.onHandBags !== null ? (
                            <>
                              <span className={cx("font-semibold", level.onHandBags < 0 ? "text-danger" : "text-ink")}>
                                {t("unit.bags", { n: formatNumber(level.onHandBags, 1) })}
                              </span>
                              <span className="block text-xs text-ink-3">
                                {formatKg(Math.max(level.onHandBags, 0) * level.feedType.packSizeKg, 0)}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-3">{t("stock.notCounted")}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-ink-2">
                          {level.avgDailyBags > 0 ? t("unit.bags", { n: formatNumber(level.avgDailyBags, 2) }) : "—"}
                        </td>
                        <td className="px-3 py-3 text-left">
                          {cover !== null && tone ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                                <div
                                  className={cx(
                                    "grow-x h-full rounded-full",
                                    tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-positive",
                                  )}
                                  style={{ width: `${Math.min(cover / 30, 1) * 100}%` }}
                                />
                              </div>
                              <span className="font-medium text-ink">{t("unit.days", { n: formatNumber(cover, 0) })}</span>
                            </div>
                          ) : level.onHandBags !== null ? (
                            <span className="text-ink-3">{t("stock.notInUse")}</span>
                          ) : level.avgDailyBags > 0 ? (
                            <Badge tone="info">{t("stock.countNeeded")}</Badge>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-left text-ink-2">
                          {level.lastCount ? (
                            <>
                              {fmt.dayKey(level.lastCount.date)}
                              <span className="block text-xs text-ink-3">
                                {t("unit.bags", { n: formatNumber(level.lastCount.bags, 1) })}
                                {level.deliveredSinceCount > 0 && ` · ${t("stock.delivered", { n: formatNumber(level.deliveredSinceCount, 1) })}`}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("stock.movements")} description={t("stock.movementsDescription")} />
            {movements.length === 0 ? (
              <EmptyState
                title={t("stock.noMovements")}
                description={t("stock.noMovementsDescription")}
              />
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <Badge tone={movement.kind === "count" ? "info" : "positive"}>
                      {movement.kind === "count" ? t("stock.stocktake") : t("stock.delivery")}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {movement.feedType.code} · {movement.kind === "delivery" ? "+" : ""}
                        {t("unit.bags", { n: formatNumber(movement.bags, 1) })}
                      </p>
                      {movement.note && <p className="truncate text-ink-3">{movement.note}</p>}
                    </div>
                    <span className="shrink-0 text-ink-3">{fmt.day(movement.date)}</span>
                    <ConfirmButton
                      action={deleteStockMovement}
                      fields={{ id: String(movement.id) }}
                      message={t("stock.deleteConfirm")}
                      label={t("stock.delete")}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <StockMovementForm
          feedTypes={levels
            .filter((level) => level.feedType.active)
            .map((level) => ({ id: level.feedType.id, code: level.feedType.code }))}
          today={today}
        />
      </div>
    </>
  );
}
