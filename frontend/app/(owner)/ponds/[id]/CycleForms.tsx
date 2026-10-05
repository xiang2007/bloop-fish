"use client";

import { useActionState, useState } from "react";
import { closeCycle, recordHarvest, startCycle } from "@/lib/actions";
import type { FormState } from "@/lib/actions";
import { useI18n } from "@/app/components/I18nProvider";
import { BoxIcon, CheckCircleIcon, PlusIcon, TrashIcon, XIcon } from "@/app/components/icons";
import { Card, CardHeader, Field, buttonClass, cx, inputClass } from "@/app/components/ui";
import { fcrRating } from "@fisheye/shared/cycle";
import { daysBetween } from "@fisheye/shared/dates";
import { formatNumber } from "@fisheye/shared/format";
import { estimateBoxes } from "@fisheye/shared/harvest";
import type { MessageKey } from "@fisheye/shared/i18n/messages/en";

const LOSS_CAUSES: { value: string; key: MessageKey }[] = [
  { value: "Disease", key: "loss.cause.disease" },
  { value: "Low oxygen / water quality", key: "loss.cause.oxygen" },
  { value: "Flood or overflow", key: "loss.cause.flood" },
  { value: "Predators or theft", key: "loss.cause.predators" },
  { value: "Other", key: "loss.cause.other" },
];

function FormFooter({ state, pending, label, danger }: { state: FormState; pending: boolean; label: string; danger?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5 sm:col-span-2">
      <button type="submit" disabled={pending} className={buttonClass(danger ? "danger" : "primary")}>
        {pending ? t("form.saving") : label}
      </button>
      {state.status === "success" && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-positive">
          <CheckCircleIcon className="size-4" />
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}

type GradeRow = { key: number; gradeId: string; kg: string; fish: string };

export function HarvestForm({
  pondId,
  today,
  stockedAt,
  grades,
  boxKg,
  standingKg,
  harvestedKg,
  feedKg,
  targetFcr,
}: {
  pondId: number;
  today: string;
  stockedAt: string;
  grades: { id: number; label: string }[];
  boxKg: number;
  // Estimated fish left in the pond before this harvest.
  standingKg: number;
  // Already harvested earlier this cycle.
  harvestedKg: number;
  feedKg: number;
  targetFcr: number;
}) {
  const { t } = useI18n();
  const blankRows = (): GradeRow[] => [{ key: 0, gradeId: "", kg: "", fish: "" }];
  const [rows, setRows] = useState<GradeRow[]>(blankRows);
  const [boxes, setBoxes] = useState("");
  const [date, setDate] = useState(today);
  const [isFinal, setIsFinal] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const result = await recordHarvest(previous, formData);
    if (result.status === "success") {
      setRows(blankRows());
      setBoxes("");
      setIsFinal(false);
    }
    return result;
  }, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  const weighedKg = rows.reduce((sum, row) => sum + (Number(row.kg) > 0 ? Number(row.kg) : 0), 0);
  const boxCount = Number(boxes) > 0 ? Number(boxes) : 0;
  const totalKg = weighedKg > 0 ? weighedKg : boxCount * boxKg;
  const fromBoxes = weighedKg === 0 && boxCount > 0;
  const leftAfter = Math.max(standingKg - totalKg, 0);
  const finalFcr = isFinal && feedKg > 0 && harvestedKg + totalKg > 0 ? feedKg / (harvestedKg + totalKg) : null;
  const day = date >= stockedAt ? daysBetween(stockedAt, date) : null;
  const usedGrades = new Set(rows.map((row) => row.gradeId));

  const update = (key: number, patch: Partial<GradeRow>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <Card>
      <CardHeader title={t("harvestForm.title")} description={t("harvestForm.description")} />
      <form action={formAction} className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
        <input type="hidden" name="pondId" value={pondId} />

        <Field
          label={t("harvestForm.date")}
          htmlFor="harvestDate"
          hint={errors.date ?? (day !== null ? t("harvestForm.dayOfCulture", { day, month: formatNumber(day / 30.4, 1) }) : undefined)}
        >
          <input
            id="harvestDate"
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            min={stockedAt}
            max={today}
            required
            className={cx(inputClass, errors.date && "border-danger")}
          />
        </Field>

        <Field
          label={t("harvestForm.boxes")}
          htmlFor="boxes"
          hint={errors.boxes ?? t("harvestForm.boxesHint", { kg: boxKg, n: estimateBoxes(standingKg, boxKg) })}
        >
          <input
            id="boxes"
            name="boxes"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            value={boxes}
            onChange={(event) => setBoxes(event.target.value)}
            className={cx(inputClass, errors.boxes && "border-danger")}
          />
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">{t("harvestForm.bySize")}</legend>
          <p className="mb-2 text-xs text-ink-3">{t("harvestForm.bySizeHint")}</p>
          <div className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_36px] gap-2 text-xs text-ink-3 sm:grid">
              <span>{t("harvestForm.grade")}</span>
              <span>{t("harvestForm.kg")}</span>
              <span>{t("harvestForm.fishOptional")}</span>
              <span />
            </div>
            {rows.map((row, index) => (
              <div key={row.key}>
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_36px] gap-2">
                  <select
                    name="gradeId"
                    value={row.gradeId}
                    onChange={(event) => update(row.key, { gradeId: event.target.value })}
                    aria-label={t("harvestForm.grade")}
                    className={cx(inputClass, errors[`line${index}`] && "border-danger")}
                  >
                    <option value="">{t("form.choose")}</option>
                    {grades.map((grade) => (
                      <option key={grade.id} value={grade.id} disabled={usedGrades.has(String(grade.id)) && row.gradeId !== String(grade.id)}>
                        {grade.label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="lineKg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    value={row.kg}
                    onChange={(event) => update(row.key, { kg: event.target.value })}
                    placeholder="kg"
                    aria-label={t("harvestForm.kg")}
                    className={inputClass}
                  />
                  <input
                    name="lineFish"
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={0}
                    value={row.fish}
                    onChange={(event) => update(row.key, { fish: event.target.value })}
                    aria-label={t("harvestForm.fishOptional")}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((current) => (current.length > 1 ? current.filter((entry) => entry.key !== row.key) : blankRows()))}
                    aria-label={t("harvestForm.removeRow")}
                    className="flex size-10 items-center justify-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
                {errors[`line${index}`] && <p className="mt-1 text-xs text-danger">{errors[`line${index}`]}</p>}
              </div>
            ))}
          </div>
          {rows.length < grades.length && (
            <button
              type="button"
              onClick={() => setRows((current) => [...current, { key: Math.max(...current.map((row) => row.key)) + 1, gradeId: "", kg: "", fish: "" }])}
              className={cx(buttonClass("ghost", "sm"), "mt-2")}
            >
              <PlusIcon className="size-3.5" />
              {t("harvestForm.addGrade")}
            </button>
          )}
          {errors.lines && <p className="mt-1 text-xs text-danger">{errors.lines}</p>}
        </fieldset>

        <Field label={t("harvestForm.fishTotal")} htmlFor="fishCount" hint={errors.fishCount ?? t("harvestForm.fishTotalHint")}>
          <input
            id="fishCount"
            name="fishCount"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className={cx(inputClass, errors.fishCount && "border-danger")}
          />
        </Field>

        <Field label={t("pond.note")} htmlFor="harvestNote" hint={t("harvestForm.noteHint")}>
          <input id="harvestNote" name="note" maxLength={300} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2 p-4 text-sm sm:col-span-2 sm:grid-cols-4">
          <Summary
            label={t("harvestForm.thisHarvest")}
            value={totalKg > 0 ? `${formatNumber(totalKg, 0)} kg` : "—"}
            sub={fromBoxes ? t("harvestForm.fromBoxes", { n: boxCount, kg: boxKg }) : totalKg > 0 ? t("unit.boxes", { n: estimateBoxes(totalKg, boxKg) }) : undefined}
          />
          <Summary label={t("harvestForm.standingBefore")} value={`${formatNumber(standingKg, 0)} kg`} />
          <Summary label={t("harvestForm.leftAfter")} value={`${formatNumber(leftAfter, 0)} kg`} sub={t("harvestForm.deducted")} />
          <Summary
            label={t("harvestForm.cycleTotal")}
            value={`${formatNumber(harvestedKg + totalKg, 0)} kg`}
            sub={harvestedKg > 0 ? t("harvestForm.earlier", { kg: formatNumber(harvestedKg, 0) }) : undefined}
          />
        </div>

        <label
          className={cx(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 sm:col-span-2",
            isFinal ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong",
          )}
        >
          <input
            type="checkbox"
            name="isFinal"
            checked={isFinal}
            onChange={(event) => setIsFinal(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--brand)]"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{t("harvestForm.final")}</span>
            <span className="block text-xs text-ink-3">{t("harvestForm.finalHint")}</span>
            {finalFcr !== null && (
              <span className="mt-1 block text-sm text-ink-2">
                {t("harvestForm.finalFcr")}{" "}
                <span
                  className={cx(
                    "font-semibold tabular-nums",
                    { good: "text-positive", watch: "text-warning", high: "text-danger" }[fcrRating(finalFcr, targetFcr)],
                  )}
                >
                  {finalFcr.toFixed(2)}
                </span>{" "}
                {t("harvestForm.finalFcrDetail", { feed: formatNumber(feedKg, 0), kg: formatNumber(harvestedKg + totalKg, 0), target: targetFcr })}
              </span>
            )}
          </span>
        </label>

        <FormFooter state={state} pending={pending} label={isFinal ? t("harvestForm.submitFinal") : t("harvestForm.submit")} />
      </form>
    </Card>
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="font-semibold tabular-nums text-ink">{value}</p>
      {sub && (
        <p className="flex items-center gap-1 text-xs text-ink-3">
          <BoxIcon className="size-3" />
          {sub}
        </p>
      )}
    </div>
  );
}

// For when the whole pond died; harvests close the cycle through HarvestForm.
export function LossForm({
  pondId,
  today,
  stockedAt,
  fishLeft,
  allDead,
}: {
  pondId: number;
  today: string;
  stockedAt: string;
  // Stocked minus recorded deaths and harvests, when the stocked count is known.
  fishLeft: number | null;
  allDead: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(closeCycle, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <Card className={cx(allDead && "border-danger/40")}>
      <details open={allDead} className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-danger text-white">
            <XIcon className="size-4" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">{t("loss.title")}</span>
            <span className="block text-sm text-ink-3">{t("loss.description")}</span>
            {allDead && <span className="mt-1 block text-xs text-danger">{t("loss.allDead")}</span>}
          </span>
        </summary>
        <form action={formAction} className="grid grid-cols-1 gap-5 border-t border-line p-5 sm:grid-cols-2">
          <input type="hidden" name="pondId" value={pondId} />
          <Field label={t("loss.date")} htmlFor="endedAt" hint={errors.endedAt}>
            <input
              id="endedAt"
              name="endedAt"
              type="date"
              defaultValue={today}
              min={stockedAt}
              max={today}
              required
              className={cx(inputClass, errors.endedAt && "border-danger")}
            />
          </Field>
          <Field label={t("loss.cause")} htmlFor="cause" hint={errors.cause}>
            <select id="cause" name="cause" defaultValue="" required className={cx(inputClass, errors.cause && "border-danger")}>
              <option value="" disabled>
                {t("form.choose")}
              </option>
              {LOSS_CAUSES.map((cause) => (
                <option key={cause.value} value={cause.value}>
                  {t(cause.key)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t("loss.fish")}
            htmlFor="lossFishCount"
            hint={errors.fishCount ?? (fishLeft !== null ? t("loss.fishHint", { n: formatNumber(fishLeft, 0) }) : t("form.optional"))}
          >
            <input
              id="lossFishCount"
              name="fishCount"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={fishLeft ?? ""}
              className={cx(inputClass, errors.fishCount && "border-danger")}
            />
          </Field>
          <Field label={t("pond.note")} htmlFor="lossNote" hint={t("loss.noteHint")}>
            <input id="lossNote" name="note" maxLength={300} className={inputClass} />
          </Field>
          <FormFooter state={state} pending={pending} label={t("loss.submit")} danger />
        </form>
      </details>
    </Card>
  );
}

export function StartCycleForm({
  pondId,
  today,
  minDate,
  suggestion,
}: {
  pondId: number;
  today: string;
  minDate: string | null;
  suggestion: string | null;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(startCycle, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <Card>
      <CardHeader title={t("start.title")} description={t("start.description")} />
      {suggestion && <p className="mx-5 mt-4 rounded-lg bg-info-soft px-3 py-2.5 text-sm text-info">{suggestion}</p>}
      <form action={formAction} className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
        <input type="hidden" name="pondId" value={pondId} />
        <Field label={t("start.date")} htmlFor="startStockedAt" hint={errors.stockedAt}>
          <input
            id="startStockedAt"
            name="stockedAt"
            type="date"
            defaultValue={today}
            min={minDate ?? undefined}
            max={today}
            required
            className={cx(inputClass, errors.stockedAt && "border-danger")}
          />
        </Field>
        <Field label={t("start.fish")} htmlFor="startStockedCount" hint={errors.stockedCount ?? t("start.fishHint")}>
          <input
            id="startStockedCount"
            name="stockedCount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="5000"
            className={cx(inputClass, errors.stockedCount && "border-danger")}
          />
        </Field>
        <FormFooter state={state} pending={pending} label={t("start.submit")} />
      </form>
    </Card>
  );
}
