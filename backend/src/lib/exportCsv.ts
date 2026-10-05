import { prisma } from "./prisma";
import { avgWeightResolver } from "@fisheye/shared/metrics";
import { dateToDayKey, monthsBetween, monthKeyOf } from "@fisheye/shared/dates";

function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// One row per recorded day, ready for Excel or another system.
// Returns null for an unknown pond.
export async function dailyRecordsCsv(pondId: number) {
  const pond = await prisma.pond.findUnique({
    where: { id: pondId },
    include: {
      dailyLogs: { orderBy: { date: "asc" }, include: { feedType: true } },
      samplings: true,
    },
  });
  if (!pond) return null;

  const avgWeightOn = avgWeightResolver(pond.samplings);
  const stockedMonth = pond.stockedAt ? monthKeyOf(pond.stockedAt) : null;
  const header = [
    "date",
    "culture_month",
    "feed_type",
    "bags",
    "feed_kg",
    "feed_cost_rm",
    "dead_fish",
    "avg_weight_kg",
    "dead_kg",
    "note",
    "recorded_by",
    "source",
  ];

  const rows = pond.dailyLogs.map((log) => {
    const avgWeight = avgWeightOn(log.date);
    return [
      dateToDayKey(log.date),
      stockedMonth ? monthsBetween(stockedMonth, monthKeyOf(log.date)) : "",
      log.feedType?.code ?? "",
      log.bags,
      log.feedKg,
      log.feedCostRm.toFixed(2),
      log.deadCount,
      avgWeight ?? "",
      avgWeight !== null ? Number((log.deadCount * avgWeight).toFixed(4)) : "",
      log.note,
      log.recordedBy,
      log.source,
    ]
      .map(csvCell)
      .join(",");
  });

  const fileName = `${pond.name.replace(/[^\w-]+/g, "-")}-daily-records.csv`;
  return { fileName, csv: [header.join(","), ...rows].join("\r\n") + "\r\n" };
}
