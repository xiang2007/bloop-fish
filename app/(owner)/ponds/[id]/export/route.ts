import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { avgWeightResolver } from "@/lib/metrics";
import { dateToDayKey, monthsBetween, monthKeyOf } from "@/lib/dates";

function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Notes are typed by workers; stop Excel treating one as a formula.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// One row per recorded day, ready for Excel or another system.
export async function GET(_request: Request, { params }: RouteContext<"/ponds/[id]/export">) {
  const session = await getSession();
  if (session?.role !== "owner") return new Response("Forbidden", { status: 403 });

  const pondId = Number((await params).id);
  if (!Number.isInteger(pondId)) return new Response("Not found", { status: 404 });
  const pond = await prisma.pond.findUnique({
    where: { id: pondId },
    include: {
      dailyLogs: { orderBy: { date: "asc" }, include: { feedType: true } },
      samplings: true,
    },
  });
  if (!pond) return new Response("Not found", { status: 404 });

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
  return new Response([header.join(","), ...rows].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
