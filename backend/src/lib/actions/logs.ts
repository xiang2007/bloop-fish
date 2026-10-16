
import { prisma } from "../prisma";
import { requireSession } from "../session";
import { daysBetween, dayKeyToDate, isDayKey, todayKey } from "@fisheye/shared/dates";
import { getI18n } from "../i18n";
import type { ActionResult } from "@fisheye/shared/forms";
import { HttpError, type Fields } from "../http";
import type { T } from "@fisheye/shared/i18n/translate";


// Workers can correct the last week; owners can edit any day.
const WORKER_EDIT_WINDOW_DAYS = 7;

function numberField(formData: Fields, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

function checkDate(date: string, role: "owner" | "worker", t: T): string | null {
  if (!isDayKey(date)) return t("error.validDate");
  const age = daysBetween(date, todayKey());
  if (age < 0) return t("error.futureDate");
  if (role === "worker" && age > WORKER_EDIT_WINDOW_DAYS) {
    return t("error.workerWindow", { n: WORKER_EDIT_WINDOW_DAYS });
  }
  return null;
}

export async function saveDailyLog(formData: Fields): Promise<ActionResult> {
  const session = await requireSession();
  const { t } = await getI18n();
  const pondId = Number(formData.get("pondId"));
  const date = String(formData.get("date") ?? "");
  const feedTypeRaw = String(formData.get("feedTypeId") ?? "");
  const bags = numberField(formData, "bags") ?? 0;
  const deadCount = numberField(formData, "deadCount") ?? 0;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const returnTo = String(formData.get("returnTo") ?? "");

  const fieldErrors: Record<string, string> = {};
  const dateError = checkDate(date, session.role, t);
  if (dateError) fieldErrors.date = dateError;
  if (!Number.isFinite(bags) || bags < 0 || bags > 200) fieldErrors.bags = t("error.bagsRange");
  if (!Number.isInteger(deadCount) || deadCount < 0 || deadCount > 100000) {
    fieldErrors.deadCount = t("error.wholeFish");
  }

  const feedTypeId = feedTypeRaw && feedTypeRaw !== "none" ? Number(feedTypeRaw) : null;
  if (bags > 0 && !feedTypeId) fieldErrors.feedTypeId = t("error.chooseFeedUsed");

  const [pond, feedType] = await Promise.all([
    Number.isInteger(pondId) ? prisma.pond.findUnique({ where: { id: pondId } }) : null,
    feedTypeId ? prisma.feedType.findUnique({ where: { id: feedTypeId } }) : null,
  ]);
  if (!pond) return { status: "error", message: t("error.pondGone") };
  if (feedTypeId && !feedType) fieldErrors.feedTypeId = t("error.feedGone");

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: t("form.checkFields"), fieldErrors };
  }

  const usedFeed = bags > 0 ? feedType : null;
  const feedKg = usedFeed ? bags * usedFeed.packSizeKg : 0;
  const data = {
    feedTypeId: usedFeed?.id ?? null,
    bags: usedFeed ? bags : 0,
    feedKg,
    feedCostRm: usedFeed ? feedKg * usedFeed.pricePerKg : 0,
    deadCount,
    note,
    recordedBy: session.name ?? (session.role === "owner" ? "Owner" : "Worker"),
    // An edited imported day becomes an app record.
    source: "app",
    importBatchId: null,
  };

  await prisma.dailyLog.upsert({
    where: { pondId_date: { pondId, date: dayKeyToDate(date) } },
    update: data,
    create: { pondId, date: dayKeyToDate(date), ...data },
  });

  return { redirect: returnTo.startsWith("/ponds/") ? returnTo : `/log?date=${date}&saved=${pondId}` };
}

export async function saveSampling(formData: Fields): Promise<ActionResult> {
  const session = await requireSession();
  const { t } = await getI18n();
  const pondId = Number(formData.get("pondId"));
  const date = String(formData.get("date") ?? "");
  const fishCount = numberField(formData, "fishCount");
  const totalWeightKg = numberField(formData, "totalWeightKg");

  const fieldErrors: Record<string, string> = {};
  const dateError = checkDate(date, session.role, t);
  if (dateError) fieldErrors.date = dateError;
  if (fishCount === null || !Number.isInteger(fishCount) || fishCount < 1 || fishCount > 10000) {
    fieldErrors.fishCount = t("error.sampleFish");
  }
  if (totalWeightKg === null || !Number.isFinite(totalWeightKg) || totalWeightKg <= 0 || totalWeightKg > 10000) {
    fieldErrors.totalWeightKg = t("error.sampleWeight");
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: t("form.checkFields"), fieldErrors };
  }

  const pond = await prisma.pond.findUnique({ where: { id: pondId } });
  if (!pond) return { status: "error", message: t("error.pondGone") };

  await prisma.sampling.create({
    data: {
      pondId,
      date: dayKeyToDate(date),
      avgWeightKg: (totalWeightKg as number) / (fishCount as number),
      sampleSize: fishCount as number,
      recordedBy: session.name ?? (session.role === "owner" ? "Owner" : "Worker"),
    },
  });

  return { status: "success", message: t("success.sampleSaved") };
}

export async function deleteDailyLog(formData: Fields) {
  const session = await requireSession();
  const id = Number(formData.get("id"));
  const log = await prisma.dailyLog.findUnique({ where: { id } });
  if (!log) return;

  if (session.role !== "owner") {
    const age = daysBetween(log.date.toISOString().slice(0, 10), todayKey());
    if (log.source !== "app" || age > WORKER_EDIT_WINDOW_DAYS) {
      throw new HttpError(403, "Only the owner can remove this record");
    }
  }

  await prisma.dailyLog.delete({ where: { id } });
}
