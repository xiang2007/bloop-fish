"use client";

import { useActionState } from "react";
import { updatePond, updatePondSpecs } from "@/lib/actions";
import type { FormState } from "@/lib/actions";
import { useI18n } from "@/app/components/I18nProvider";
import { CheckCircleIcon } from "@/app/components/icons";
import { Card, CardHeader, Field, buttonClass, cx, inputClass } from "@/app/components/ui";

type Pond = {
  id: number;
  name: string;
  species: string | null;
  farmId: number | null;
  stockedAt: string | null;
  stockedCount: number | null;
  assumedFcr: number;
  cycleMonths: number;
  targetWeightKg: number | null;
  active: boolean;
};

export type PondSpecs = {
  id: number;
  areaM2: number | null;
  depthM: number | null;
  pondType: string | null;
  waterSource: string | null;
  aerators: number | null;
  waterStatus: string | null;
  waterNote: string | null;
  waterCheckedAt: string | null;
};

function Footer({ state, pending, label }: { state: FormState; pending: boolean; label: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 border-t border-line pt-5 sm:col-span-2">
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
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

export default function PondSettingsForm({
  pond,
  specs,
  farms,
  today,
}: {
  pond: Pond;
  specs: PondSpecs;
  farms: { id: number; name: string }[];
  today: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePond, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <div className="grid max-w-6xl grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title={t("pondSettings.title")} description={t("pondSettings.description")} />
        <form action={formAction} className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={pond.id} />
          <Field label={t("pondSettings.name")} htmlFor="name" hint={errors.name}>
            <input id="name" name="name" defaultValue={pond.name} required maxLength={40} className={cx(inputClass, errors.name && "border-danger")} />
          </Field>
          <Field label={t("specs.farm")} htmlFor="farmId" hint={errors.farmId}>
            <select id="farmId" name="farmId" defaultValue={pond.farmId ?? ""} className={cx(inputClass, errors.farmId && "border-danger")}>
              <option value="">{t("farmMap.unassigned")}</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("specs.species")} htmlFor="species" hint={t("pondSettings.speciesHint")}>
            <input id="species" name="species" defaultValue={pond.species ?? ""} maxLength={60} className={inputClass} />
          </Field>
          <Field label={t("start.date")} htmlFor="stockedAt" hint={errors.stockedAt ?? t("pondSettings.stockedAtHint")}>
            <input
              id="stockedAt"
              name="stockedAt"
              type="date"
              defaultValue={pond.stockedAt ?? ""}
              className={cx(inputClass, errors.stockedAt && "border-danger")}
            />
          </Field>
          <Field label={t("start.fish")} htmlFor="stockedCount" hint={errors.stockedCount ?? t("pondSettings.stockedCountHint")}>
            <input
              id="stockedCount"
              name="stockedCount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              defaultValue={pond.stockedCount ?? ""}
              placeholder="5000"
              className={cx(inputClass, errors.stockedCount && "border-danger")}
            />
          </Field>
          <Field label={t("pondSettings.fcr")} htmlFor="assumedFcr" hint={errors.assumedFcr ?? t("pondSettings.fcrHint")}>
            <input
              id="assumedFcr"
              name="assumedFcr"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.5}
              max={5}
              defaultValue={pond.assumedFcr}
              required
              className={cx(inputClass, errors.assumedFcr && "border-danger")}
            />
          </Field>
          <Field label={t("pondSettings.cycleMonths")} htmlFor="cycleMonths" hint={errors.cycleMonths ?? t("pondSettings.cycleMonthsHint")}>
            <input
              id="cycleMonths"
              name="cycleMonths"
              type="number"
              inputMode="numeric"
              min={1}
              max={36}
              step={1}
              defaultValue={pond.cycleMonths}
              required
              className={cx(inputClass, errors.cycleMonths && "border-danger")}
            />
          </Field>
          <Field label={t("pondSettings.target")} htmlFor="targetWeightKg" hint={errors.targetWeightKg ?? t("pondSettings.targetHint")}>
            <input
              id="targetWeightKg"
              name="targetWeightKg"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              defaultValue={pond.targetWeightKg ?? ""}
              placeholder="0.9"
              className={cx(inputClass, errors.targetWeightKg && "border-danger")}
            />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <label className="flex h-10 items-center gap-2.5 text-sm text-ink-2">
              <input type="checkbox" name="active" defaultChecked={pond.active} className="size-4 accent-[var(--brand)]" />
              {t("pondSettings.active")}
            </label>
          </div>
          <Footer state={state} pending={pending} label={t("pondSettings.save")} />
        </form>
      </Card>

      <PondSpecsForm specs={specs} today={today} />
    </div>
  );
}

function PondSpecsForm({ specs, today }: { specs: PondSpecs; today: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePondSpecs, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const numberInput = (name: keyof PondSpecs, step: string) => (
    <input
      id={name}
      name={name}
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      defaultValue={(specs[name] as number | null) ?? ""}
      className={cx(inputClass, errors[name] && "border-danger")}
    />
  );

  return (
    <Card>
      <div id="specs" className="scroll-mt-6" />
      <CardHeader title={t("specs.title")} description={t("specsForm.description")} />
      <form action={formAction} className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
        <input type="hidden" name="id" value={specs.id} />
        <Field label={t("specsForm.area")} htmlFor="areaM2" hint={errors.areaM2}>
          {numberInput("areaM2", "any")}
        </Field>
        <Field label={t("specsForm.depth")} htmlFor="depthM" hint={errors.depthM}>
          {numberInput("depthM", "0.1")}
        </Field>
        <Field label={t("specs.type")} htmlFor="pondType" hint={t("specsForm.typeHint")}>
          <input id="pondType" name="pondType" defaultValue={specs.pondType ?? ""} maxLength={60} className={inputClass} />
        </Field>
        <Field label={t("specs.waterSource")} htmlFor="waterSource" hint={t("specsForm.sourceHint")}>
          <input id="waterSource" name="waterSource" defaultValue={specs.waterSource ?? ""} maxLength={60} className={inputClass} />
        </Field>
        <Field label={t("specs.aerators")} htmlFor="aerators" hint={errors.aerators}>
          {numberInput("aerators", "1")}
        </Field>
        <div className="hidden sm:block" />

        <fieldset className="grid grid-cols-1 gap-5 rounded-lg bg-surface-2 p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="sr-only">{t("specs.water")}</legend>
          <Field label={t("specs.water")} htmlFor="waterStatus" hint={errors.waterStatus}>
            <select id="waterStatus" name="waterStatus" defaultValue={specs.waterStatus ?? ""} className={inputClass}>
              <option value="">{t("specs.notChecked")}</option>
              <option value="good">{t("specs.water.good")}</option>
              <option value="fair">{t("specs.water.fair")}</option>
              <option value="poor">{t("specs.water.poor")}</option>
            </select>
          </Field>
          <Field label={t("specsForm.checkedOn")} htmlFor="waterCheckedAt" hint={errors.waterCheckedAt ?? t("specsForm.checkedOnHint")}>
            <input
              id="waterCheckedAt"
              name="waterCheckedAt"
              type="date"
              max={today}
              defaultValue={specs.waterCheckedAt ?? ""}
              className={cx(inputClass, errors.waterCheckedAt && "border-danger")}
            />
          </Field>
          <Field label={t("specsForm.waterNote")} htmlFor="waterNote" hint={t("specsForm.waterNoteHint")} className="sm:col-span-2">
            <input id="waterNote" name="waterNote" defaultValue={specs.waterNote ?? ""} maxLength={300} className={inputClass} />
          </Field>
        </fieldset>
        <Footer state={state} pending={pending} label={t("specsForm.save")} />
      </form>
    </Card>
  );
}
