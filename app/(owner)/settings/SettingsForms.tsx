"use client";

import { useActionState } from "react";
import { createPond, deleteFarm, saveBoxKg, saveFarm, saveFeedType, saveSizeGrade } from "@/app/actions/owner";
import { createUser, saveUser } from "@/app/actions/users";
import type { FormState } from "@/app/actions/logs";
import ConfirmButton from "@/app/components/ConfirmButton";
import { useI18n } from "@/app/components/I18nProvider";
import { CheckIcon, PlusIcon } from "@/app/components/icons";
import { buttonClass, cx, inputClass } from "@/app/components/ui";

const compactInput = `${inputClass} h-9`;

function firstError(state: FormState) {
  if (state.status !== "error") return null;
  return Object.values(state.fieldErrors ?? {})[0] ?? state.message ?? null;
}

function SaveButton({ formId, state, pending }: { formId: string; state: FormState; pending: boolean }) {
  const { t } = useI18n();
  return (
    <button form={formId} type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
      {state.status === "success" && !pending ? <CheckIcon className="size-3.5 text-positive" /> : null}
      {pending ? t("form.saving") : state.status === "success" ? t("form.saved") : t("form.save")}
    </button>
  );
}

function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  return (
    <p className={cx("mt-2 text-sm", state.status === "error" ? "text-danger" : "text-positive")}>
      {state.status === "error" ? firstError(state) : state.message}
    </p>
  );
}

export function FeedTypeRow({
  feedType,
}: {
  feedType: { id: number; code: string; packSizeKg: number; pricePerKg: number; active: boolean; uses: number };
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveFeedType, { status: "idle" });
  const formId = `feed-type-${feedType.id}`;
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const message = firstError(state);

  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="px-5 py-2.5">
        <form id={formId} action={formAction}>
          <input type="hidden" name="id" value={feedType.id} />
        </form>
        <input
          form={formId}
          name="code"
          defaultValue={feedType.code}
          aria-label={t("settings.feedCode")}
          className={cx(compactInput, "w-24 font-medium uppercase", errors.code && "border-danger")}
        />
        <p className="mt-1 text-xs text-ink-3">{t("settings.daysLogged", { n: feedType.uses })}</p>
      </td>
      <td className="px-2 py-2.5">
        <input
          form={formId}
          name="packSizeKg"
          type="number"
          step="any"
          min={0}
          defaultValue={feedType.packSizeKg}
          aria-label={t("settings.bagKgAria", { code: feedType.code })}
          className={cx(compactInput, "w-20", errors.packSizeKg && "border-danger")}
        />
      </td>
      <td className="px-2 py-2.5">
        <input
          form={formId}
          name="pricePerKg"
          type="number"
          step="0.01"
          min={0}
          defaultValue={feedType.pricePerKg}
          aria-label={t("settings.priceAria", { code: feedType.code })}
          className={cx(compactInput, "w-24", errors.pricePerKg && "border-danger")}
        />
      </td>
      <td className="px-2 py-2.5">
        <label className="flex h-9 items-center">
          <input
            form={formId}
            type="checkbox"
            name="active"
            defaultChecked={feedType.active}
            aria-label={t("settings.activeAria", { name: feedType.code })}
            className="size-4 accent-[var(--brand)]"
          />
        </label>
      </td>
      <td className="px-5 py-2.5 text-right">
        <SaveButton formId={formId} state={state} pending={pending} />
        {message && <p className="mt-1 max-w-36 text-left text-xs text-danger">{message}</p>}
      </td>
    </tr>
  );
}

export function NewFeedTypeForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveFeedType, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="border-t border-line p-5">
      <p className="mb-3 text-sm font-medium text-ink-2">{t("settings.addFeed")}</p>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2">
        <input name="code" placeholder={t("settings.code")} required aria-label={t("settings.feedCode")} className={cx(compactInput, "uppercase", errors.code && "border-danger")} />
        <input name="packSizeKg" type="number" step="any" min={0} placeholder={t("settings.bagKg")} defaultValue={20} required aria-label={t("settings.bagKg")} className={compactInput} />
        <input name="pricePerKg" type="number" step="0.01" min={0} placeholder={t("settings.rmKg")} required aria-label={t("settings.rmKg")} className={compactInput} />
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm") + " h-9"}>
          <PlusIcon className="size-3.5" />
          {t("form.add")}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function NewPondForm({ farms }: { farms: { id: number; name: string }[] }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPond, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="border-t border-line p-5">
      <p className="mb-3 text-sm font-medium text-ink-2">{t("settings.addPond")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input name="name" placeholder={t("pondSettings.name")} required maxLength={40} aria-label={t("pondSettings.name")} className={cx(compactInput, errors.name && "border-danger")} />
        <select name="farmId" defaultValue={farms[0]?.id ?? ""} aria-label={t("specs.farm")} className={compactInput}>
          <option value="">{t("farmMap.unassigned")}</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
        <input name="stockedAt" type="date" aria-label={t("start.date")} className={cx(compactInput, errors.stockedAt && "border-danger")} />
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm") + " h-9"}>
          <PlusIcon className="size-3.5" />
          {t("settings.addPondButton")}
        </button>
      </div>
      {state.status === "error" && <p className="mt-2 text-sm text-danger">{firstError(state)}</p>}
    </form>
  );
}

export function FarmRow({ farm }: { farm: { id: number; name: string; ponds: number } }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveFarm, { status: "idle" });
  const formId = `farm-${farm.id}`;
  return (
    <li className="flex flex-wrap items-center gap-2 px-5 py-2.5">
      <form id={formId} action={formAction} className="min-w-0 flex-1">
        <input type="hidden" name="id" value={farm.id} />
        <input name="name" defaultValue={farm.name} required maxLength={40} aria-label={t("settings.farmName")} className={compactInput} />
      </form>
      <span className="w-20 text-xs text-ink-3">{t("settings.pondCount", { n: farm.ponds })}</span>
      <SaveButton formId={formId} state={state} pending={pending} />
      <ConfirmButton
        action={deleteFarm}
        fields={{ id: String(farm.id) }}
        message={t("settings.deleteFarmConfirm", { name: farm.name })}
        label={t("settings.deleteFarm")}
      />
      {state.status === "error" && <p className="w-full text-xs text-danger">{firstError(state)}</p>}
    </li>
  );
}

export function NewFarmForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveFarm, { status: "idle" });
  return (
    <form action={formAction} className="border-t border-line p-5">
      <p className="mb-3 text-sm font-medium text-ink-2">{t("settings.addFarm")}</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="name" placeholder={t("settings.farmName")} required maxLength={40} aria-label={t("settings.farmName")} className={compactInput} />
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm") + " h-9"}>
          <PlusIcon className="size-3.5" />
          {t("form.add")}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

type Grade = { id: number; label: string; minKg: number | null; maxKg: number | null; sortOrder: number; active: boolean; uses: number };

export function GradeRow({ grade }: { grade: Grade }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSizeGrade, { status: "idle" });
  const formId = `grade-${grade.id}`;
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="px-5 py-2.5">
        <form id={formId} action={formAction}>
          <input type="hidden" name="id" value={grade.id} />
        </form>
        <input form={formId} name="label" defaultValue={grade.label} required maxLength={30} aria-label={t("settings.gradeName")} className={cx(compactInput, "w-32", errors.label && "border-danger")} />
        <p className="mt-1 text-xs text-ink-3">{t("settings.gradeUses", { n: grade.uses })}</p>
      </td>
      <td className="px-2 py-2.5">
        <input form={formId} name="minKg" type="number" step="any" min={0} defaultValue={grade.minKg ?? ""} aria-label={t("settings.minKg")} className={cx(compactInput, "w-20", errors.minKg && "border-danger")} />
      </td>
      <td className="px-2 py-2.5">
        <input form={formId} name="maxKg" type="number" step="any" min={0} defaultValue={grade.maxKg ?? ""} aria-label={t("settings.maxKg")} className={cx(compactInput, "w-20", errors.maxKg && "border-danger")} />
      </td>
      <td className="px-2 py-2.5">
        <input form={formId} name="sortOrder" type="number" step={1} defaultValue={grade.sortOrder} aria-label={t("settings.order")} className={cx(compactInput, "w-16")} />
      </td>
      <td className="px-2 py-2.5">
        <label className="flex h-9 items-center">
          <input form={formId} type="checkbox" name="active" defaultChecked={grade.active} aria-label={t("settings.activeAria", { name: grade.label })} className="size-4 accent-[var(--brand)]" />
        </label>
      </td>
      <td className="px-5 py-2.5 text-right">
        <SaveButton formId={formId} state={state} pending={pending} />
        {state.status === "error" && <p className="mt-1 max-w-36 text-left text-xs text-danger">{firstError(state)}</p>}
      </td>
    </tr>
  );
}

export function NewGradeForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSizeGrade, { status: "idle" });
  return (
    <form action={formAction} className="border-t border-line p-5">
      <p className="mb-3 text-sm font-medium text-ink-2">{t("settings.addGrade")}</p>
      <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-start gap-2">
        <input name="label" placeholder={t("settings.gradeName")} required maxLength={30} aria-label={t("settings.gradeName")} className={compactInput} />
        <input name="minKg" type="number" step="any" min={0} placeholder={t("settings.minKg")} aria-label={t("settings.minKg")} className={compactInput} />
        <input name="maxKg" type="number" step="any" min={0} placeholder={t("settings.maxKg")} aria-label={t("settings.maxKg")} className={compactInput} />
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm") + " h-9"}>
          <PlusIcon className="size-3.5" />
          {t("form.add")}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function BoxKgForm({ boxKg }: { boxKg: number }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveBoxKg, { status: "idle" });
  return (
    <form action={formAction} className="p-5">
      <label htmlFor="boxKg" className="mb-1.5 block text-sm font-medium text-ink-2">
        {t("settings.boxKg")}
      </label>
      <div className="flex gap-2">
        <input id="boxKg" name="boxKg" type="number" step="any" min={1} defaultValue={boxKg} required className={cx(compactInput, "max-w-40")} />
        <button type="submit" disabled={pending} className={buttonClass("primary", "sm") + " h-9"}>
          {pending ? t("form.saving") : t("form.save")}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-3">{t("settings.boxKgHint")}</p>
      <FormMessage state={state} />
    </form>
  );
}

export type UserEntry = { id: number; name: string; username: string; role: "owner" | "worker"; active: boolean; isMe: boolean };

function RoleSelect({ defaultValue, form, label }: { defaultValue: string; form?: string; label: string }) {
  const { t } = useI18n();
  return (
    <select name="role" form={form} defaultValue={defaultValue} aria-label={label} className={compactInput}>
      <option value="worker">{t("users.roleWorker")}</option>
      <option value="owner">{t("users.roleOwner")}</option>
    </select>
  );
}

export function UserRow({ user }: { user: UserEntry }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveUser, { status: "idle" });
  const formId = `user-${user.id}`;
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const message = firstError(state);

  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="px-5 py-2.5">
        <form id={formId} action={formAction}>
          <input type="hidden" name="id" value={user.id} />
        </form>
        <p className="font-medium text-ink">
          {user.name}
          {user.isMe && <span className="ml-2 text-xs font-normal text-ink-3">{t("users.you")}</span>}
        </p>
        <p className="text-xs text-ink-3">{user.username}</p>
      </td>
      <td className="px-2 py-2.5">
        <RoleSelect form={formId} defaultValue={user.role} label={t("users.role")} />
      </td>
      <td className="px-2 py-2.5">
        <input
          form={formId}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={t("users.newPassword")}
          aria-label={t("users.newPasswordAria", { name: user.name })}
          className={cx(compactInput, "w-40", errors.password && "border-danger")}
        />
      </td>
      <td className="px-2 py-2.5">
        <label className="flex h-9 items-center">
          <input
            form={formId}
            type="checkbox"
            name="active"
            defaultChecked={user.active}
            aria-label={t("settings.activeAria", { name: user.name })}
            className="size-4 accent-[var(--brand)]"
          />
        </label>
      </td>
      <td className="px-5 py-2.5 text-right">
        <SaveButton formId={formId} state={state} pending={pending} />
        {message && state.status === "error" && <p className="mt-1 max-w-40 text-left text-xs text-danger">{message}</p>}
      </td>
    </tr>
  );
}

export function NewUserForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(createUser, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="border-t border-line p-5">
      <p className="mb-3 text-sm font-medium text-ink-2">{t("users.add")}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input name="name" placeholder={t("users.name")} required maxLength={40} aria-label={t("users.name")} className={cx(compactInput, errors.name && "border-danger")} />
        <input
          name="username"
          placeholder={t("users.username")}
          required
          maxLength={30}
          autoCapitalize="none"
          autoComplete="off"
          aria-label={t("users.username")}
          className={cx(compactInput, errors.username && "border-danger")}
        />
        <input
          name="password"
          type="password"
          placeholder={t("signin.password")}
          required
          autoComplete="new-password"
          aria-label={t("signin.password")}
          className={cx(compactInput, errors.password && "border-danger")}
        />
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <RoleSelect defaultValue="worker" label={t("users.role")} />
          </div>
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm") + " h-9"}>
            <PlusIcon className="size-3.5" />
            {t("form.add")}
          </button>
        </div>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
