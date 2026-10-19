"use client";

import { useActionState, useState } from "react";
import { recordStockMovement } from "@/lib/actions";
import type { FormState } from "@/lib/actions";
import { CheckCircleIcon } from "@/app/components/icons";
import { useI18n } from "@/app/components/I18nProvider";
import { Card, CardHeader, Field, buttonClass, cx, inputClass } from "@/app/components/ui";

export default function StockMovementForm({
  feedTypes,
  today,
}: {
  feedTypes: { id: number; code: string }[];
  today: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordStockMovement, { status: "idle" });
  const [kind, setKind] = useState<"count" | "delivery">("count");
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <Card className="h-fit">
      <CardHeader title={t("stock.record")} description={t("stock.recordDescription")} />
      <form action={formAction} className="space-y-4 p-5">
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-3 p-1" role="radiogroup" aria-label={t("stock.movementType")}>
          {(["count", "delivery"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => setKind(option)}
              className={cx(
                "h-8 rounded-md text-sm font-medium",
                kind === option ? "bg-surface text-ink" : "text-ink-3 hover:text-ink",
              )}
            >
              {option === "count" ? t("stock.stocktake") : t("stock.delivery")}
            </button>
          ))}
        </div>

        <Field label={t("pond.col.feedType")} htmlFor="feedTypeId" hint={errors.feedTypeId}>
          <select id="feedTypeId" name="feedTypeId" className={inputClass} required defaultValue="">
            <option value="" disabled>
              {t("form.choose")}
            </option>
            {feedTypes.map((feedType) => (
              <option key={feedType.id} value={feedType.id}>
                {feedType.code}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === "count" ? t("stock.bagsInStore") : t("stock.bagsReceived")} htmlFor="bags" hint={errors.bags}>
            <input
              id="bags"
              name="bags"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              className={cx(inputClass, errors.bags && "border-danger")}
            />
          </Field>
          <Field label={t("harvests.col.date")} htmlFor="date" hint={errors.date}>
            <input id="date" name="date" type="date" max={today} defaultValue={today} required className={inputClass} />
          </Field>
        </div>
        <Field label={t("stock.noteOptional")} htmlFor="stock-note">
          <input
            id="stock-note"
            name="note"
            maxLength={200}
            placeholder={kind === "delivery" ? t("stock.deliveryPlaceholder") : t("stock.countPlaceholder")}
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
          {pending ? t("form.saving") : kind === "count" ? t("stock.saveCount") : t("stock.saveDelivery")}
        </button>
        {state.status === "success" && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-positive">
            <CheckCircleIcon className="size-4" />
            {state.message}
          </p>
        )}
        <p className="text-xs leading-5 text-ink-3">
          {t("stock.help")}
        </p>
      </form>
    </Card>
  );
}
