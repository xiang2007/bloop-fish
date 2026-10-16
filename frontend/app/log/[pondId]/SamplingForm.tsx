"use client";

import { useActionState, useState } from "react";
import { saveSampling, type FormState } from "@/lib/actions";
import { CheckCircleIcon, ScaleIcon } from "@/app/components/icons";
import { Badge, buttonClass, cx, inputClass } from "@/app/components/ui";
import { formatAbw } from "@fisheye/shared/format";
import { useI18n } from "@/app/components/I18nProvider";

const SAMPLING_DUE_DAYS = 25;

export default function SamplingForm({
  pondId,
  date,
  lastSampling,
}: {
  pondId: number;
  date: string;
  lastSampling: { label: string; daysAgo: number } | null;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSampling, { status: "idle" });
  const [fishCount, setFishCount] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const due = !lastSampling || lastSampling.daysAgo >= SAMPLING_DUE_DAYS;
  const average = Number(fishCount) > 0 && Number(totalWeight) > 0 ? Number(totalWeight) / Number(fishCount) : null;
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <details className="group mt-4 rounded-lg border border-line bg-surface" open={due && state.status !== "success"}>
      <summary className="flex cursor-pointer items-center gap-3 p-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-info-soft text-info">
          <ScaleIcon className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold text-ink">
            {t("sample.title")}
            {due && <Badge tone="warning">{t("sample.due")}</Badge>}
          </span>
          <span className="block truncate text-sm text-ink-3">
            {lastSampling ? t("sample.last", { label: lastSampling.label }) : t("sample.none")}
          </span>
        </span>
      </summary>

      <form action={formAction} className="border-t border-line p-4">
        <input type="hidden" name="pondId" value={pondId} />
        <input type="hidden" name="date" value={date} />
        <p className="mb-3 text-sm text-ink-3">
          {t("sample.help")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fishCount" className="mb-1.5 block text-sm font-medium text-ink-2">
              {t("pond.fishWeighed")}
            </label>
            <input
              id="fishCount"
              name="fishCount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={fishCount}
              onChange={(event) => setFishCount(event.target.value)}
              placeholder="20"
              aria-invalid={Boolean(errors.fishCount)}
              className={cx(inputClass, "h-12 text-base", errors.fishCount && "border-danger")}
            />
          </div>
          <div>
            <label htmlFor="totalWeightKg" className="mb-1.5 block text-sm font-medium text-ink-2">
              {t("sample.totalWeight")}
            </label>
            <input
              id="totalWeightKg"
              name="totalWeightKg"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={totalWeight}
              onChange={(event) => setTotalWeight(event.target.value)}
              placeholder="18.5"
              aria-invalid={Boolean(errors.totalWeightKg)}
              className={cx(inputClass, "h-12 text-base", errors.totalWeightKg && "border-danger")}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-3">
            {average !== null ? (
              <>
                {t("sample.average")} <span className="font-semibold tabular-nums text-ink">{formatAbw(average)}</span> {t("sample.perFish")}
              </>
            ) : (
              t("sample.averageHint")
            )}
          </p>
          <button type="submit" disabled={pending} className={buttonClass("secondary", "md")}>
            {pending ? t("form.saving") : t("sample.save")}
          </button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {errors.date ?? errors.fishCount ?? errors.totalWeightKg ?? state.message}
          </p>
        )}
        {state.status === "success" && (
          <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-positive">
            <CheckCircleIcon className="size-4" />
            {state.message}
          </p>
        )}
      </form>
    </details>
  );
}
