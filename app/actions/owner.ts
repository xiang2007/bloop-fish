"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { dateToDayKey, dayKeyToDate, isDayKey, todayKey } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { PondReportError, normalizeFeedCode, parsePondReport } from "@/lib/import/pondReport";
import { buildImportPlan } from "@/lib/import/plan";
import { commitImportPlan } from "@/lib/import/commit";
import { checkCsvFile, decodeCsv } from "@/lib/import/validate";
import { allow } from "@/lib/rateLimit";
import { getBoxKg } from "@/lib/settings";
import type { FormState } from "./logs";

const MAX_SHEET_BYTES = 900 * 1024;
const WATER_STATUSES = ["good", "fair", "poor"];

function text(formData: FormData, name: string, max = 80) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function optionalNumber(formData: FormData, name: string) {
  return parseOptionalNumber(text(formData, name));
}

function parseOptionalNumber(raw: string) {
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

async function invalid(fieldErrors: Record<string, string>): Promise<FormState> {
  const { t } = await getI18n();
  return { status: "error", message: t("form.checkFields"), fieldErrors };
}

async function nameTaken(name: string, exceptId?: number) {
  const existing = await prisma.pond.findUnique({ where: { name } });
  return existing !== null && existing.id !== exceptId;
}

// Blank, or a positive number up to max.
function checkOptionalPositive(value: number | null, max: number) {
  return value === null || (value > 0 && value <= max);
}

export async function updatePond(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const id = Number(formData.get("id"));
  const name = text(formData, "name", 40);
  const species = text(formData, "species", 60) || null;
  const stockedAt = text(formData, "stockedAt");
  const stockedCount = optionalNumber(formData, "stockedCount");
  const assumedFcr = optionalNumber(formData, "assumedFcr");
  const cycleMonths = optionalNumber(formData, "cycleMonths");
  const targetWeightKg = optionalNumber(formData, "targetWeightKg");
  const farmRaw = text(formData, "farmId");
  const farmId = farmRaw ? Number(farmRaw) : null;

  const errors: Record<string, string> = {};
  if (!name) errors.name = t("error.pondName");
  else if (await nameTaken(name, id)) errors.name = t("error.pondNameTaken");
  if (stockedAt && (!isDayKey(stockedAt) || stockedAt > todayKey())) errors.stockedAt = t("error.pastDate");
  else if (stockedAt) {
    const lastEnd = await lastCycleEnd(id);
    if (lastEnd && stockedAt <= lastEnd) errors.stockedAt = t("error.afterLastCycle", { date: lastEnd });
  }
  if (cycleMonths === null || !Number.isInteger(cycleMonths) || cycleMonths < 1 || cycleMonths > 36) {
    errors.cycleMonths = t("error.cycleMonths");
  }
  if (stockedCount !== null && (!Number.isInteger(stockedCount) || stockedCount < 1)) {
    errors.stockedCount = t("error.wholeFishOrBlank");
  }
  if (assumedFcr === null || !(assumedFcr >= 0.5 && assumedFcr <= 5)) errors.assumedFcr = t("error.fcrRange");
  if (!checkOptionalPositive(targetWeightKg, 50)) errors.targetWeightKg = t("error.targetWeight");
  if (farmId !== null && !(await prisma.farm.findUnique({ where: { id: farmId } }))) errors.farmId = t("error.chooseFarm");
  if (Object.keys(errors).length > 0) return invalid(errors);

  await prisma.pond.update({
    where: { id },
    data: {
      name,
      species,
      farmId,
      stockedAt: stockedAt ? dayKeyToDate(stockedAt) : null,
      stockedCount: stockedCount ?? null,
      assumedFcr: assumedFcr as number,
      cycleMonths: cycleMonths as number,
      targetWeightKg,
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: t("success.pondSaved") };
}

// The pond's physical specs and the owner's latest read of the water.
export async function updatePondSpecs(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const id = Number(formData.get("id"));
  const areaM2 = optionalNumber(formData, "areaM2");
  const depthM = optionalNumber(formData, "depthM");
  const aerators = optionalNumber(formData, "aerators");
  const pondType = text(formData, "pondType", 60) || null;
  const waterSource = text(formData, "waterSource", 60) || null;
  const waterStatus = text(formData, "waterStatus") || null;
  const waterNote = text(formData, "waterNote", 300) || null;
  const waterCheckedAt = text(formData, "waterCheckedAt");

  const errors: Record<string, string> = {};
  if (!checkOptionalPositive(areaM2, 1_000_000)) errors.areaM2 = t("error.positiveOrBlank");
  if (!checkOptionalPositive(depthM, 50)) errors.depthM = t("error.positiveOrBlank");
  if (aerators !== null && (!Number.isInteger(aerators) || aerators < 0 || aerators > 500)) {
    errors.aerators = t("error.wholeNumberOrBlank");
  }
  if (waterStatus !== null && !WATER_STATUSES.includes(waterStatus)) errors.waterStatus = t("error.chooseOption");
  if (waterCheckedAt && (!isDayKey(waterCheckedAt) || waterCheckedAt > todayKey())) errors.waterCheckedAt = t("error.pastDate");
  if (Object.keys(errors).length > 0) return invalid(errors);

  await prisma.pond.update({
    where: { id },
    data: {
      areaM2,
      depthM,
      aerators,
      pondType,
      waterSource,
      waterStatus,
      waterNote,
      // A new water reading without a date counts as checked today.
      waterCheckedAt: waterCheckedAt ? dayKeyToDate(waterCheckedAt) : waterStatus ? dayKeyToDate(todayKey()) : null,
    },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: t("success.specsSaved") };
}

export async function createPond(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const name = text(formData, "name", 40);
  const species = text(formData, "species", 60) || null;
  const stockedAt = text(formData, "stockedAt");
  const farmRaw = text(formData, "farmId");
  const farmId = farmRaw ? Number(farmRaw) : null;

  const errors: Record<string, string> = {};
  if (!name) errors.name = t("error.pondName");
  else if (await nameTaken(name)) errors.name = t("error.pondExists");
  if (stockedAt && (!isDayKey(stockedAt) || stockedAt > todayKey())) errors.stockedAt = t("error.pastDate");
  if (farmId !== null && !(await prisma.farm.findUnique({ where: { id: farmId } }))) errors.farmId = t("error.chooseFarm");
  if (Object.keys(errors).length > 0) return invalid(errors);

  const pond = await prisma.pond.create({
    data: { name, species, farmId, stockedAt: stockedAt ? dayKeyToDate(stockedAt) : null },
  });
  revalidatePath("/", "layout");
  redirect(`/ponds/${pond.id}`);
}

export async function saveFarm(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const name = text(formData, "name", 40);

  if (!name) return invalid({ name: t("error.farmName") });
  const existing = await prisma.farm.findUnique({ where: { name } });
  if (existing && existing.id !== id) return invalid({ name: t("error.farmExists") });

  if (id) await prisma.farm.update({ where: { id }, data: { name } });
  else await prisma.farm.create({ data: { name } });
  revalidatePath("/", "layout");
  return { status: "success", message: id ? t("success.saved") : t("success.farmAdded", { name }) };
}

export async function deleteFarm(formData: FormData) {
  await requireOwner();
  // Its ponds stay, without a farm.
  await prisma.farm.delete({ where: { id: Number(formData.get("id")) } });
  revalidatePath("/", "layout");
}

export async function deletePond(formData: FormData) {
  await requireOwner();
  // Its cycles, daily logs, samplings, harvests and imports go with it.
  await prisma.pond.delete({ where: { id: Number(formData.get("id")) } });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function saveSizeGrade(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const label = text(formData, "label", 30);
  const minKg = optionalNumber(formData, "minKg");
  const maxKg = optionalNumber(formData, "maxKg");
  const sortOrder = optionalNumber(formData, "sortOrder");

  const errors: Record<string, string> = {};
  if (!label) errors.label = t("error.gradeLabel");
  else {
    const existing = await prisma.sizeGrade.findUnique({ where: { label } });
    if (existing && existing.id !== id) errors.label = t("error.gradeExists");
  }
  if (!checkOptionalPositive(minKg, 100)) errors.minKg = t("error.positiveOrBlank");
  if (!checkOptionalPositive(maxKg, 100)) errors.maxKg = t("error.positiveOrBlank");
  if (minKg !== null && maxKg !== null && minKg >= maxKg) errors.maxKg = t("error.maxAboveMin");
  if (sortOrder !== null && !Number.isInteger(sortOrder)) errors.sortOrder = t("error.wholeNumberOrBlank");
  if (Object.keys(errors).length > 0) return invalid(errors);

  const data = {
    label,
    minKg,
    maxKg,
    active: id ? formData.get("active") === "on" : true,
    ...(sortOrder !== null ? { sortOrder } : {}),
  };
  if (id) await prisma.sizeGrade.update({ where: { id }, data });
  else {
    const last = await prisma.sizeGrade.findFirst({ orderBy: { sortOrder: "desc" } });
    await prisma.sizeGrade.create({ data: { ...data, sortOrder: sortOrder ?? (last?.sortOrder ?? 0) + 1 } });
  }
  revalidatePath("/", "layout");
  return { status: "success", message: id ? t("success.saved") : t("success.gradeAdded", { label }) };
}

export async function saveBoxKg(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const boxKg = optionalNumber(formData, "boxKg");
  if (boxKg === null || !(boxKg > 0 && boxKg <= 5000)) return invalid({ boxKg: t("error.boxKg") });
  await prisma.setting.upsert({ where: { key: "boxKg" }, update: { value: String(boxKg) }, create: { key: "boxKg", value: String(boxKg) } });
  revalidatePath("/", "layout");
  return { status: "success", message: t("success.saved") };
}

export async function saveFeedType(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const code = normalizeFeedCode(text(formData, "code", 20));
  const packSizeKg = optionalNumber(formData, "packSizeKg");
  const pricePerKg = optionalNumber(formData, "pricePerKg");

  const errors: Record<string, string> = {};
  if (!code) errors.code = t("error.feedCode");
  if (packSizeKg === null || !(packSizeKg > 0 && packSizeKg <= 100)) errors.packSizeKg = t("error.bagSize");
  if (pricePerKg === null || !(pricePerKg >= 0 && pricePerKg <= 100)) errors.pricePerKg = t("error.pricePerKg");
  if (code) {
    const existing = await prisma.feedType.findUnique({ where: { code } });
    if (existing && existing.id !== id) errors.code = t("error.feedCodeExists");
  }
  if (Object.keys(errors).length > 0) return invalid(errors);

  const data = {
    code: code as string,
    packSizeKg: packSizeKg as number,
    pricePerKg: pricePerKg as number,
    active: id ? formData.get("active") === "on" : true,
  };
  if (id) await prisma.feedType.update({ where: { id }, data });
  else await prisma.feedType.create({ data });

  revalidatePath("/", "layout");
  return { status: "success", message: id ? t("success.feedPriceSaved") : t("success.feedAdded", { code: code as string }) };
}

export async function recordStockMovement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const feedTypeId = Number(formData.get("feedTypeId"));
  const kind = text(formData, "kind");
  const date = text(formData, "date");
  const bags = optionalNumber(formData, "bags");
  const note = text(formData, "note", 200) || null;

  const errors: Record<string, string> = {};
  if (!(await prisma.feedType.findUnique({ where: { id: feedTypeId } }))) errors.feedTypeId = t("error.chooseFeedType");
  if (kind !== "delivery" && kind !== "count") errors.kind = t("error.deliveryOrCount");
  if (!isDayKey(date) || date > todayKey()) errors.date = t("error.validDate");
  if (bags === null || !(bags >= 0 && bags <= 100000) || (kind === "delivery" && bags === 0)) {
    errors.bags = t("error.bags");
  }
  if (Object.keys(errors).length > 0) return invalid(errors);

  await prisma.stockMovement.create({
    data: { feedTypeId, kind, date: dayKeyToDate(date), bags: bags as number, note },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: kind === "count" ? t("success.stocktake") : t("success.delivery") };
}

export async function deleteStockMovement(formData: FormData) {
  await requireOwner();
  await prisma.stockMovement.delete({ where: { id: Number(formData.get("id")) } });
  revalidatePath("/", "layout");
}

export async function deleteSampling(formData: FormData) {
  await requireOwner();
  await prisma.sampling.delete({ where: { id: Number(formData.get("id")) } });
  revalidatePath("/", "layout");
}

export async function deleteImportBatch(formData: FormData) {
  await requireOwner();
  // Cascades to the daily logs and samplings created by this import.
  await prisma.importBatch.delete({ where: { id: Number(formData.get("id")) } });
  revalidatePath("/", "layout");
}

export async function importSpreadsheet(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireOwner();
  const { t } = await getI18n();
  // Parsing a sheet is the heaviest thing a request can ask for.
  if (!(await allow(`import:${session.userId}`, 10, 10 * 60 * 1000))) {
    return { status: "error", message: t("error.importRate") };
  }
  const file = formData.get("file");
  const target = text(formData, "target");
  const newPondName = text(formData, "newPondName", 40);
  const species = text(formData, "species", 60) || null;

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: t("error.chooseCsv") };
  }
  if (file.size > MAX_SHEET_BYTES) {
    return { status: "error", message: t("error.csvTooLarge") };
  }
  if (checkCsvFile(file)) return { status: "error", message: t("error.notCsv") };
  const decoded = decodeCsv(new Uint8Array(await file.arrayBuffer()));
  if ("rejected" in decoded) {
    return { status: "error", message: t(decoded.rejected === "unsafe" ? "error.csvUnsafe" : "error.notCsv") };
  }

  const errors: Record<string, string> = {};
  let pondId: number | null = null;
  if (target === "new") {
    if (!newPondName) errors.newPondName = t("error.nameNewPond");
    else if (await nameTaken(newPondName)) errors.newPondName = t("error.pondExists");
  } else {
    pondId = Number(target);
    if (!(await prisma.pond.findUnique({ where: { id: pondId } }))) errors.target = t("error.choosePond");
  }
  if (Object.keys(errors).length > 0) return invalid(errors);

  let plan;
  try {
    const parsed = parsePondReport(decoded.text);
    plan = buildImportPlan(parsed, await prisma.feedType.findMany());
  } catch (error) {
    if (error instanceof PondReportError) return { status: "error", message: error.message };
    throw error;
  }
  if (plan.logs.length === 0) {
    return { status: "error", message: t("error.noDailyEntries") };
  }

  const result = await commitImportPlan(
    prisma,
    plan,
    pondId !== null ? { pondId } : { newPond: { name: newPondName, species } },
    file.name.slice(0, 120),
  );

  revalidatePath("/", "layout");
  redirect(`/ponds/${result.pondId}?view=data&imported=${result.batchId}`);
}

async function lastCycleEnd(pondId: number) {
  const last = await prisma.pondCycle.findFirst({ where: { pondId }, orderBy: { number: "desc" } });
  return last ? dateToDayKey(last.endedAt) : null;
}

// Records one harvest of the running cycle. Several can be taken; the one
// marked final closes the cycle, with its FCR worked out from the total
// harvested across all of them.
export async function recordHarvest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireOwner();
  const { t } = await getI18n();
  const pondId = Number(formData.get("pondId"));
  const date = text(formData, "date");
  const boxes = optionalNumber(formData, "boxes");
  const fishCountRaw = optionalNumber(formData, "fishCount");
  const note = text(formData, "note", 300) || null;
  const isFinal = formData.get("isFinal") === "on";

  const pond = await prisma.pond.findUnique({ where: { id: pondId } });
  if (!pond?.stockedAt) return { status: "error", message: t("error.noRunningCycle") };
  const stockedKey = dateToDayKey(pond.stockedAt);

  const errors: Record<string, string> = {};
  if (!isDayKey(date) || date > todayKey() || date < stockedKey) errors.date = t("error.dateInCycle");

  // Size-grade rows arrive as parallel lists; blank rows are skipped.
  const gradeIds = formData.getAll("gradeId").map(String);
  const kgs = formData.getAll("lineKg").map(String);
  const fishes = formData.getAll("lineFish").map(String);
  const grades = await prisma.sizeGrade.findMany({ select: { id: true } });
  const gradeSet = new Set(grades.map((grade) => grade.id));
  const lines: { gradeId: number; kg: number; fishCount: number | null }[] = [];
  gradeIds.forEach((gradeRaw, index) => {
    const kg = parseOptionalNumber(kgs[index]?.trim() ?? "");
    const fish = parseOptionalNumber(fishes[index]?.trim() ?? "");
    if (!gradeRaw && kg === null && fish === null) return;
    const gradeId = Number(gradeRaw);
    if (!gradeSet.has(gradeId)) errors[`line${index}`] = t("error.chooseGrade");
    else if (kg === null || !(kg > 0 && kg <= 1_000_000)) errors[`line${index}`] = t("error.gradeKg");
    else if (fish !== null && (!Number.isInteger(fish) || fish < 0)) errors[`line${index}`] = t("error.wholeNumberOrBlank");
    else if (lines.some((line) => line.gradeId === gradeId)) errors[`line${index}`] = t("error.gradeTwice");
    else lines.push({ gradeId, kg, fishCount: fish });
  });

  if (boxes !== null && !(boxes > 0 && boxes <= 10_000)) errors.boxes = t("error.positiveOrBlank");
  if (fishCountRaw !== null && (!Number.isInteger(fishCountRaw) || fishCountRaw < 0)) errors.fishCount = t("error.wholeNumberOrBlank");

  // Weighed grades win; otherwise boxes × box weight is the estimate.
  const boxKg = await getBoxKg();
  const weighedKg = lines.reduce((sum, line) => sum + line.kg, 0);
  const totalKg = weighedKg > 0 ? weighedKg : boxes ? boxes * boxKg : 0;
  if (totalKg <= 0 && !errors.boxes) errors.lines = t("error.harvestWeight");
  if (Object.keys(errors).length > 0) return invalid(errors);

  const lineFish = lines.every((line) => line.fishCount !== null) && lines.length > 0
    ? lines.reduce((sum, line) => sum + (line.fishCount ?? 0), 0)
    : null;
  const fishCount = fishCountRaw ?? lineFish;

  await prisma.$transaction(async (tx) => {
    await tx.harvest.create({
      data: {
        pondId,
        date: dayKeyToDate(date),
        totalKg,
        boxes,
        fishCount,
        isFinal,
        note,
        recordedBy: session.name ?? "Owner",
        lines: { create: lines },
      },
    });
    if (!isFinal) return;

    const cycleHarvests = await tx.harvest.findMany({ where: { pondId, cycleId: null } });
    const cycle = await closeRunningCycle(tx, pond, date, {
      outcome: "harvested",
      harvestKg: cycleHarvests.reduce((sum, harvest) => sum + harvest.totalKg, 0),
      fishCount: cycleHarvests.every((harvest) => harvest.fishCount !== null)
        ? cycleHarvests.reduce((sum, harvest) => sum + (harvest.fishCount ?? 0), 0)
        : null,
      cause: null,
      note,
    });
    await tx.harvest.updateMany({ where: { pondId, cycleId: null }, data: { cycleId: cycle.id } });
  });

  revalidatePath("/", "layout");
  return { status: "success", message: isFinal ? t("success.finalHarvest") : t("success.harvest") };
}

// Removes a harvest of the running cycle. Harvests of closed cycles are
// changed by reopening the cycle first.
export async function deleteHarvest(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const harvest = await prisma.harvest.findUnique({ where: { id } });
  if (!harvest || harvest.cycleId !== null) return;
  await prisma.harvest.delete({ where: { id } });
  revalidatePath("/", "layout");
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function closeRunningCycle(
  tx: Tx,
  pond: { id: number; stockedAt: Date | null; stockedCount: number | null },
  endedAt: string,
  result: { outcome: "harvested" | "lost"; harvestKg: number; fishCount: number | null; cause: string | null; note: string | null },
) {
  const logs = await tx.dailyLog.aggregate({
    where: { pondId: pond.id, date: { gte: pond.stockedAt!, lte: dayKeyToDate(endedAt) } },
    _sum: { feedKg: true, feedCostRm: true, deadCount: true },
  });
  const last = await tx.pondCycle.findFirst({ where: { pondId: pond.id }, orderBy: { number: "desc" } });
  const cycle = await tx.pondCycle.create({
    data: {
      pondId: pond.id,
      number: (last?.number ?? 0) + 1,
      stockedAt: pond.stockedAt!,
      stockedCount: pond.stockedCount,
      endedAt: dayKeyToDate(endedAt),
      ...result,
      feedKg: logs._sum.feedKg ?? 0,
      feedCostRm: logs._sum.feedCostRm ?? 0,
      deadCount: logs._sum.deadCount ?? 0,
    },
  });
  await tx.pond.update({ where: { id: pond.id }, data: { stockedAt: null, stockedCount: null } });
  return cycle;
}

// Ends the running cycle as a total loss. Anything harvested before the loss
// stays with the cycle. Harvests are closed through recordHarvest instead.
export async function closeCycle(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const pondId = Number(formData.get("pondId"));
  const endedAt = text(formData, "endedAt");
  const fishCount = optionalNumber(formData, "fishCount");
  const cause = text(formData, "cause", 60) || null;
  const note = text(formData, "note", 300) || null;

  const pond = await prisma.pond.findUnique({ where: { id: pondId } });
  if (!pond?.stockedAt) return { status: "error", message: t("error.noRunningCycle") };
  const stockedKey = dateToDayKey(pond.stockedAt);

  const errors: Record<string, string> = {};
  if (!isDayKey(endedAt) || endedAt > todayKey() || endedAt < stockedKey) errors.endedAt = t("error.dateInCycle");
  if (fishCount !== null && (!Number.isInteger(fishCount) || fishCount < 0)) errors.fishCount = t("error.wholeNumberOrBlank");
  if (!cause) errors.cause = t("error.chooseCause");
  if (Object.keys(errors).length > 0) return invalid(errors);

  await prisma.$transaction(async (tx) => {
    const partials = await tx.harvest.findMany({ where: { pondId, cycleId: null } });
    const cycle = await closeRunningCycle(tx, pond, endedAt, {
      outcome: "lost",
      harvestKg: partials.reduce((sum, harvest) => sum + harvest.totalKg, 0),
      fishCount,
      cause,
      note,
    });
    await tx.harvest.updateMany({ where: { pondId, cycleId: null }, data: { cycleId: cycle.id } });
  });

  revalidatePath("/", "layout");
  return { status: "success", message: t("success.cycleLost") };
}

export async function startCycle(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireOwner();
  const { t } = await getI18n();
  const pondId = Number(formData.get("pondId"));
  const stockedAt = text(formData, "stockedAt");
  const stockedCount = optionalNumber(formData, "stockedCount");

  const pond = await prisma.pond.findUnique({ where: { id: pondId } });
  if (!pond) return { status: "error", message: t("error.pondMissing") };
  if (pond.stockedAt) return { status: "error", message: t("error.closeFirst") };

  const errors: Record<string, string> = {};
  const lastEnd = await lastCycleEnd(pondId);
  if (!isDayKey(stockedAt) || stockedAt > todayKey()) errors.stockedAt = t("error.pastDate");
  else if (lastEnd && stockedAt <= lastEnd) errors.stockedAt = t("error.afterLastCycle", { date: lastEnd });
  if (stockedCount !== null && (!Number.isInteger(stockedCount) || stockedCount < 1)) {
    errors.stockedCount = t("error.wholeFishOrBlank");
  }
  if (Object.keys(errors).length > 0) return invalid(errors);

  await prisma.pond.update({
    where: { id: pondId },
    data: { stockedAt: dayKeyToDate(stockedAt), stockedCount: stockedCount ?? null },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: t("success.cycleStarted") };
}

// Undoes the most recent close, for when a cycle was ended by mistake. The
// harvest that closed it is removed; earlier partial harvests go back to
// the running cycle.
export async function reopenLastCycle(formData: FormData) {
  await requireOwner();
  const pondId = Number(formData.get("pondId"));
  const pond = await prisma.pond.findUnique({ where: { id: pondId } });
  const last = await prisma.pondCycle.findFirst({ where: { pondId }, orderBy: { number: "desc" } });
  if (!pond || pond.stockedAt || !last) return;

  await prisma.$transaction(async (tx) => {
    await tx.harvest.deleteMany({ where: { cycleId: last.id, isFinal: true } });
    await tx.harvest.updateMany({ where: { cycleId: last.id }, data: { cycleId: null } });
    await tx.pond.update({
      where: { id: pondId },
      data: { stockedAt: last.stockedAt, stockedCount: last.stockedCount },
    });
    await tx.pondCycle.delete({ where: { id: last.id } });
  });
  revalidatePath("/", "layout");
}
