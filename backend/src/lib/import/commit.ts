import type { PrismaClient } from "../../generated/prisma/client";
import { dayKeyToDate, dateToDayKey } from "@fisheye/shared/dates";
import type { Finding } from "@fisheye/shared/import/pondReport";
import type { ImportPlan } from "@fisheye/shared/import/plan";

export type ImportTarget = { pondId: number } | { newPond: { name: string; species?: string | null } };

export type ImportResult = {
  pondId: number;
  batchId: number;
  imported: number;
  keptFromApp: number;
};

// Writes an import plan in one transaction. Days already entered through the
// app are kept (they are the newer record); days from an earlier import of
// the same pond are replaced so a sheet can be re-imported after it grows.
export async function commitImportPlan(
  prisma: PrismaClient,
  plan: ImportPlan,
  target: ImportTarget,
  fileName: string,
): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    for (const feedType of plan.newFeedTypes) {
      await tx.feedType.upsert({
        where: { code: feedType.code },
        update: {},
        create: feedType,
      });
    }
    const feedTypes = await tx.feedType.findMany();
    const feedTypeIdByCode = new Map(feedTypes.map((feedType) => [feedType.code, feedType.id]));

    const pond =
      "pondId" in target
        ? await tx.pond.findUniqueOrThrow({ where: { id: target.pondId } })
        : await tx.pond.create({
            data: {
              name: target.newPond.name,
              species: target.newPond.species ?? null,
              stockedAt: dayKeyToDate(plan.stockedAt),
            },
          });

    if (!pond.stockedAt) {
      await tx.pond.update({
        where: { id: pond.id },
        data: { stockedAt: dayKeyToDate(plan.stockedAt) },
      });
    }

    const dates = plan.logs.map((log) => dayKeyToDate(log.date));
    const existing = await tx.dailyLog.findMany({
      where: { pondId: pond.id, date: { in: dates } },
      select: { date: true, source: true },
    });
    const appDays = new Set(
      existing.filter((log) => log.source !== "import").map((log) => dateToDayKey(log.date)),
    );

    await tx.dailyLog.deleteMany({
      where: { pondId: pond.id, source: "import", date: { in: dates } },
    });
    await tx.sampling.deleteMany({
      where: {
        pondId: pond.id,
        source: "import",
        date: { in: plan.samplings.map((sampling) => dayKeyToDate(sampling.date)) },
      },
    });

    const findings: Finding[] = [...plan.findings];
    if (appDays.size > 0) {
      findings.push({
        severity: "info",
        title: `${appDays.size} ${appDays.size === 1 ? "day was" : "days were"} already recorded in Fisheye`,
        detail: "Those app entries were kept and the matching spreadsheet rows were skipped.",
      });
    }

    const batch = await tx.importBatch.create({
      data: {
        pondId: pond.id,
        fileName,
        summary: JSON.stringify({ totals: plan.totals, months: plan.months }),
        findings: JSON.stringify(findings),
      },
    });

    const rows = plan.logs
      .filter((log) => !appDays.has(log.date))
      .map((log) => ({
        pondId: pond.id,
        date: dayKeyToDate(log.date),
        feedTypeId: log.feedCode ? (feedTypeIdByCode.get(log.feedCode) ?? null) : null,
        bags: log.bags,
        feedKg: log.feedKg,
        feedCostRm: log.feedCostRm,
        deadCount: log.deadCount,
        source: "import",
        importBatchId: batch.id,
      }));
    await tx.dailyLog.createMany({ data: rows });

    await tx.sampling.createMany({
      data: plan.samplings.map((sampling) => ({
        pondId: pond.id,
        date: dayKeyToDate(sampling.date),
        avgWeightKg: sampling.avgWeightKg,
        source: "import",
        importBatchId: batch.id,
      })),
    });

    return {
      pondId: pond.id,
      batchId: batch.id,
      imported: rows.length,
      keptFromApp: appDays.size,
    };
  });
}
