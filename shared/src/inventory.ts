import { addDays, dateToDayKey } from "./dates";

export type StockFeedType = {
  id: number;
  code: string;
  packSizeKg: number;
  pricePerKg: number;
  active: boolean;
};

export type StockMovementRow = {
  feedTypeId: number;
  date: Date;
  kind: string;
  bags: number;
};

export type UsageRow = {
  feedTypeId: number | null;
  date: Date;
  bags: number;
};

export type StockLevel = {
  feedType: StockFeedType;
  lastCount: { date: string; bags: number } | null;
  deliveredSinceCount: number;
  usedSinceCount: number;
  onHandBags: number | null;
  avgDailyBags: number;
  daysOfCover: number | null;
  lastDelivery: string | null;
};

export const USAGE_WINDOW_DAYS = 14;
export const LOW_STOCK_DAYS = 7;

// A stocktake ("count") is the stock at the end of its day; deliveries and
// usage after that day move the balance. Without a stocktake the balance is
// unknown rather than guessed.
export function computeStockLevels(
  feedTypes: StockFeedType[],
  movements: StockMovementRow[],
  usage: UsageRow[],
  horizon: string,
): StockLevel[] {
  const windowStart = addDays(horizon, -(USAGE_WINDOW_DAYS - 1));

  return feedTypes.map((feedType) => {
    const own = movements
      .filter((movement) => movement.feedTypeId === feedType.id)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const count = own.filter((movement) => movement.kind === "count").at(-1) ?? null;
    const countKey = count ? dateToDayKey(count.date) : null;
    const after = (date: Date) => countKey === null || dateToDayKey(date) > countKey;

    const deliveredSinceCount = own
      .filter((movement) => movement.kind === "delivery" && after(movement.date))
      .reduce((sum, movement) => sum + movement.bags, 0);
    const ownUsage = usage.filter((row) => row.feedTypeId === feedType.id);
    const usedSinceCount = ownUsage
      .filter((row) => after(row.date))
      .reduce((sum, row) => sum + row.bags, 0);
    const recent = ownUsage
      .filter((row) => {
        const key = dateToDayKey(row.date);
        return key >= windowStart && key <= horizon;
      })
      .reduce((sum, row) => sum + row.bags, 0);

    const onHandBags = count ? count.bags + deliveredSinceCount - usedSinceCount : null;
    const avgDailyBags = recent / USAGE_WINDOW_DAYS;
    const lastDelivery = own.filter((movement) => movement.kind === "delivery").at(-1);

    return {
      feedType,
      lastCount: count ? { date: countKey as string, bags: count.bags } : null,
      deliveredSinceCount,
      usedSinceCount,
      onHandBags,
      avgDailyBags,
      daysOfCover:
        onHandBags !== null && avgDailyBags > 0 ? Math.max(onHandBags, 0) / avgDailyBags : null,
      lastDelivery: lastDelivery ? dateToDayKey(lastDelivery.date) : null,
    };
  });
}
