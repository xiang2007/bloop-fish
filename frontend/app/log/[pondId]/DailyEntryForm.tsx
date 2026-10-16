"use client";

import { useActionState, useState } from "react";
import { saveDailyLog, type FormState } from "@/lib/actions";
import { CheckIcon, FeedIcon, MinusIcon, PlusIcon, SkullIcon } from "@/app/components/icons";
import { buttonClass, cx } from "@/app/components/ui";
import { addDays } from "@fisheye/shared/dates";
import { formatKg, formatNumber, formatRm } from "@fisheye/shared/format";
import { useI18n } from "@/app/components/I18nProvider";

type FeedTypeOption = { id: number; code: string; packSizeKg: number; pricePerKg: number };

type Props = {
  pondId: number;
  pondName: string;
  date: string;
  returnTo: string;
  feedTypes: FeedTypeOption[];
  existing: {
    feedTypeId: number | null;
    bags: number;
    deadCount: number;
    note: string | null;
    recordedBy: string | null;
    source: string;
  } | null;
  previous: {
    date: string;
    feedTypeId: number | null;
    feedCode: string | null;
    bags: number;
    feedKg: number;
    deadCount: number;
    note: string | null;
    recordedBy: string | null;
  } | null;
  defaultFeedTypeId: number | null;
};

const QUICK_BAGS = [0.5, 1, 1.5, 2, 2.5, 3];

export default function DailyEntryForm({
  pondId,
  pondName,
  date,
  returnTo,
  feedTypes,
  existing,
  previous,
  defaultFeedTypeId,
}: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveDailyLog, { status: "idle" });

  const initialFeed = existing
    ? existing.bags > 0 && existing.feedTypeId
      ? String(existing.feedTypeId)
      : "none"
    : String(defaultFeedTypeId ?? feedTypes[0]?.id ?? "none");
  const [feedTypeId, setFeedTypeId] = useState(initialFeed);
  const [bags, setBags] = useState(existing ? String(existing.bags || "") : "");
  const [deadCount, setDeadCount] = useState(existing ? String(existing.deadCount) : "0");

  const selected = feedTypes.find((feedType) => String(feedType.id) === feedTypeId);
  const bagsValue = Number(bags) || 0;
  const noFeed = feedTypeId === "none";
  const feedKg = selected && !noFeed ? bagsValue * selected.packSizeKg : 0;
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  function copyPrevious() {
    if (!previous) return;
    if (previous.bags > 0 && previous.feedTypeId) {
      setFeedTypeId(String(previous.feedTypeId));
      setBags(String(previous.bags));
    } else {
      setFeedTypeId("none");
      setBags("");
    }
  }

  function stepBags(delta: number) {
    const next = Math.max(0, Math.round((bagsValue + delta) * 2) / 2);
    setBags(next === 0 ? "" : String(next));
    if (noFeed && next > 0) setFeedTypeId(String(defaultFeedTypeId ?? feedTypes[0]?.id ?? "none"));
  }

  function stepDead(delta: number) {
    setDeadCount(String(Math.max(0, (Number(deadCount) || 0) + delta)));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="pondId" value={pondId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="feedTypeId" value={feedTypeId} />
      <input type="hidden" name="bags" value={noFeed ? "0" : bags || "0"} />

      {existing && (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info">
          {existing.recordedBy
            ? t("entry.alreadyBy", { name: existing.recordedBy })
            : existing.source === "import"
              ? t("entry.alreadyImport")
              : t("entry.already")}
        </p>
      )}

      {previous ? (
        <YesterdayBox previous={previous} date={date} onCopy={copyPrevious} />
      ) : (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-3">{t("entry.noHistory")}</p>
      )}

      <fieldset className="rounded-lg border border-line bg-surface p-4">
        <legend className="sr-only">{t("entry.feed")}</legend>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <FeedIcon className="size-4.5" />
          </span>
          <h2 className="font-semibold text-ink">{t("entry.feedGiven")}</h2>
        </div>

        <p id="feed-type-label" className="mb-2 text-sm font-medium text-ink-2">
          {t("entry.feedType")}
        </p>
        <div role="radiogroup" aria-labelledby="feed-type-label" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {feedTypes.map((feedType) => {
            const active = String(feedType.id) === feedTypeId;
            return (
              <button
                key={feedType.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFeedTypeId(String(feedType.id))}
                className={cx(
                  "flex h-14 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
                  active
                    ? "border-brand bg-brand-soft text-brand ring-1 ring-brand"
                    : "border-line bg-surface text-ink hover:border-line-strong",
                )}
              >
                {feedType.code}
                <span className={cx("text-[11px] font-normal", active ? "text-brand/80" : "text-ink-3")}>
                  {t("entry.bagKg", { kg: feedType.packSizeKg })}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={noFeed}
            onClick={() => {
              setFeedTypeId("none");
              setBags("");
            }}
            className={cx(
              "flex h-14 items-center justify-center rounded-lg border text-sm font-semibold",
              noFeed ? "border-ink-2 bg-surface-3 text-ink ring-1 ring-ink-2" : "border-line text-ink-3 hover:border-line-strong",
            )}
          >
            {t("log.noFeeding")}
          </button>
        </div>
        {errors.feedTypeId && <p className="mt-2 text-sm text-danger">{errors.feedTypeId}</p>}

        {!noFeed && (
          <>
            <label htmlFor="bags-input" className="mt-5 mb-2 block text-sm font-medium text-ink-2">
              {t("entry.bagsUsed")}
            </label>
            <Stepper
              id="bags-input"
              value={bags}
              onChange={setBags}
              onStep={stepBags}
              step={0.5}
              inputMode="decimal"
              placeholder="0"
              invalid={Boolean(errors.bags)}
              unit={t("entry.bagsUnit")}
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              {QUICK_BAGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBags(String(value))}
                  className={cx(
                    "h-9 min-w-12 rounded-lg border px-3 text-sm font-medium tabular-nums",
                    bagsValue === value
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line text-ink-2 hover:border-line-strong",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            {errors.bags && <p className="mt-2 text-sm text-danger">{errors.bags}</p>}
            <p className="mt-3 text-sm text-ink-3">
              {selected && bagsValue > 0 ? (
                <>
                  = <span className="font-semibold tabular-nums text-ink">{formatKg(feedKg)}</span> ·{" "}
                  <span className="tabular-nums">{formatRm(feedKg * selected.pricePerKg)}</span>
                </>
              ) : (
                t("entry.bagsHint")
              )}
            </p>
          </>
        )}
      </fieldset>

      <fieldset className="rounded-lg border border-line bg-surface p-4">
        <legend className="sr-only">{t("overview.deadFish")}</legend>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-danger-soft text-danger">
            <SkullIcon className="size-4.5" />
          </span>
          <h2 className="font-semibold text-ink">{t("entry.deadFound")}</h2>
        </div>
        <label htmlFor="dead-input" className="sr-only">
          {t("entry.deadCount")}
        </label>
        <Stepper
          id="dead-input"
          name="deadCount"
          value={deadCount}
          onChange={setDeadCount}
          onStep={stepDead}
          step={1}
          inputMode="numeric"
          placeholder="0"
          invalid={Boolean(errors.deadCount)}
          unit={t("unit.fish")}
        />
        {errors.deadCount && <p className="mt-2 text-sm text-danger">{errors.deadCount}</p>}
      </fieldset>

      <details className="group rounded-lg border border-line bg-surface" open={Boolean(existing?.note)}>
        <summary className="flex h-12 cursor-pointer items-center justify-between px-4 text-sm font-medium text-ink-2">
          {t("entry.addNote")}
          <PlusIcon className="size-4 transition-transform group-open:rotate-45" />
        </summary>
        <div className="px-4 pb-4">
          <label htmlFor="note" className="sr-only">
            {t("pond.note")}
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            defaultValue={existing?.note ?? ""}
            placeholder={t("entry.notePlaceholder")}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
          />
        </div>
      </details>

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errors.date ?? state.message}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button type="submit" disabled={pending} className={`${buttonClass("primary", "lg")} w-full`}>
            <CheckIcon className="size-5" />
            {pending ? t("form.saving") : existing ? t("entry.update", { pond: pondName }) : t("entry.save", { pond: pondName })}
          </button>
        </div>
      </div>
    </form>
  );
}

function Stepper({
  id,
  name,
  value,
  onChange,
  onStep,
  step,
  inputMode,
  placeholder,
  invalid,
  unit,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onStep: (delta: number) => void;
  step: number;
  inputMode: "decimal" | "numeric";
  placeholder: string;
  invalid: boolean;
  unit: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cx(
        "flex h-14 items-stretch overflow-hidden rounded-lg border bg-surface",
        invalid ? "border-danger" : "border-line-strong focus-within:border-brand",
      )}
    >
      <button
        type="button"
        onClick={() => onStep(-step)}
        className="flex w-16 items-center justify-center border-r border-line text-ink-2 active:bg-surface-3"
        aria-label={t("entry.decrease", { step })}
      >
        <MinusIcon className="size-5" />
      </button>
      <div className="relative flex flex-1 items-center">
        <input
          id={id}
          name={name}
          type="number"
          inputMode={inputMode}
          step={step === 1 ? 1 : "any"}
          min={0}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid}
          className="h-full w-full bg-transparent text-center text-2xl font-semibold tabular-nums text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-3 text-sm text-ink-3">{unit}</span>
      </div>
      <button
        type="button"
        onClick={() => onStep(step)}
        className="flex w-16 items-center justify-center border-l border-line text-ink-2 active:bg-surface-3"
        aria-label={t("entry.increase", { step })}
      >
        <PlusIcon className="size-5" />
      </button>
    </div>
  );
}

// What happened in this pond the day before, so the worker picks up where
// the last shift left off. Falls back to the latest entry, flagged, when the
// day before wasn't logged.
function YesterdayBox({
  previous,
  date,
  onCopy,
}: {
  previous: NonNullable<Props["previous"]>;
  date: string;
  onCopy: () => void;
}) {
  const { t, fmt } = useI18n();
  const isDayBefore = previous.date === addDays(date, -1);
  return (
    <section aria-labelledby="yesterday-heading" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 id="yesterday-heading" className="font-mono text-xs tracking-wide text-ink-3 uppercase">
          {isDayBefore ? t("entry.yesterday") : t("entry.lastEntry")} · {fmt.dayKey(previous.date, { weekday: true, year: false })}
        </h2>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft"
        >
          {t("entry.copy")}
        </button>
      </div>
      {!isDayBefore && <p className="bg-warning-soft px-4 py-2 text-sm text-warning">{t("entry.yesterdayMissing")}</p>}
      <dl className="grid grid-cols-2 divide-x divide-line">
        <div className="px-4 py-3">
          <dt className="text-xs text-ink-3">{t("entry.feedGiven")}</dt>
          <dd className="mt-0.5 text-lg font-semibold text-ink tabular-nums">
            {previous.bags > 0 ? fmt.bags(previous.bags) : t("log.noFeeding")}
          </dd>
          {previous.bags > 0 && (
            <dd className="text-sm text-ink-2 tabular-nums">
              {previous.feedCode} · {formatKg(previous.feedKg, 0)}
            </dd>
          )}
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-ink-3">{t("overview.deadFish")}</dt>
          <dd className={cx("mt-0.5 text-lg font-semibold tabular-nums", previous.deadCount > 5 ? "text-danger" : "text-ink")}>
            {formatNumber(previous.deadCount, 0)}
          </dd>
        </div>
      </dl>
      {(previous.note || previous.recordedBy) && (
        <p className="border-t border-line px-4 py-2.5 text-sm text-ink-2">
          {previous.note && <span className="text-ink">&ldquo;{previous.note}&rdquo; </span>}
          {previous.recordedBy && <span className="text-ink-3">— {previous.recordedBy}</span>}
        </p>
      )}
    </section>
  );
}
