"use client";

import Link from "next/link";
import { redirect, useSearchParams } from "next/navigation";
import { addDays, isDayKey, todayKey } from "@fisheye/shared/dates";
import { formatNumber } from "@fisheye/shared/format";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { logDayData } from "@backend/lib/pages";
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
} from "../components/icons";
import { buttonClass, cx, inputClass } from "../components/ui";

// Past this many ponds the checklist becomes a grid of pond numbers.
const LIST_LIMIT = 12;

// "Pond 12" -> "12"; workers find a pond by the number on its sign.
function pondNumber(name: string) {
  return name.match(/\d+/)?.[0] ?? null;
}

type LogDayData = Awaited<ReturnType<typeof logDayData>>;

export default function DailyLogPage() {
  const params = useSearchParams();
  const today = todayKey();
  const requested = params.get("date") ?? today;
  const date = isDayKey(requested) && requested <= today ? requested : today;
  return (
    <Api<LogDayData> path={`/log?date=${date}`}>
      {(data) => <DailyLog data={data} date={date} savedPondId={Number(params.get("saved"))} typed={params.get("pond")?.trim() ?? ""} />}
    </Api>
  );
}

function DailyLog({ data, date, savedPondId, typed }: { data: LogDayData; date: string; savedPondId: number; typed: string }) {
  const { t, fmt } = useI18n();
  useTitle(t("nav.dailyLog"));
  const today = todayKey();
  const { ponds, session } = data;

  // A pond typed into the number box: open it straight away.
  if (typed) {
    const match = /^\d+$/.test(typed)
      ? ponds.find(({ pond }) => pondNumber(pond.name) === String(Number(typed)))
      : ponds.find(({ pond }) => pond.name.toLowerCase() === typed.toLowerCase());
    if (match) redirect(`/log/${match.pond.id}?date=${date}`);
  }
  const done = ponds.filter((entry) => entry.today).length;
  const isToday = date === today;
  const savedPond = ponds.find((entry) => entry.pond.id === savedPondId)?.pond;
  const nextPending = ponds.find((entry) => !entry.today);

  return (
    <>
      {savedPond && (
        <div
          role="status"
          className="mb-4 flex items-center gap-3 rounded-lg border border-positive/25 bg-positive-soft px-4 py-3 text-sm text-positive"
        >
          <CheckCircleIcon className="size-5 shrink-0" />
          <span className="font-medium">{t("log.saved", { pond: savedPond.name })}</span>
          {nextPending && (
            <Link
              href={`/log/${nextPending.pond.id}?date=${date}`}
              className="ml-auto font-semibold underline-offset-2 hover:underline"
            >
              {t("log.next", { pond: nextPending.pond.name })}
            </Link>
          )}
        </div>
      )}

      <section className="mb-5">
        <p className="text-sm text-ink-3">
          {session?.name ? t("log.hiName", { name: session.name }) : t("log.hello")} {isToday ? t("log.todayChecklist") : t("log.pastDay")}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-1.5">
          <Link
            href={`/log?date=${addDays(date, -1)}`}
            className="flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-3"
            aria-label={t("log.previousDay")}
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          <div className="text-center">
            <p className="text-base font-semibold text-ink">
              {isToday ? t("board.today") : fmt.dayKey(date, { weekday: true, year: false })}
            </p>
            <p className="text-xs text-ink-3">{fmt.dayKey(date, { weekday: isToday })}</p>
          </div>
          {isToday ? (
            <span className="size-11" aria-hidden="true" />
          ) : (
            <Link
              href={`/log?date=${addDays(date, 1)}`}
              className="flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-3"
              aria-label={t("log.nextDay")}
            >
              <ChevronRightIcon className="size-5" />
            </Link>
          )}
        </div>
      </section>

      <form action="/log" className="mb-6 rounded-lg border border-line bg-surface p-4">
        <input type="hidden" name="date" value={date} />
        <label htmlFor="pond-number" className="mb-2 block text-sm font-medium text-ink-2">
          {t("log.pondNumber")}
        </label>
        <div className="flex gap-2">
          <input
            id="pond-number"
            name="pond"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="go"
            placeholder="12"
            defaultValue={typed}
            aria-invalid={typed ? true : undefined}
            aria-describedby={typed ? "pond-number-error" : undefined}
            className={cx(inputClass, "h-14 min-w-0 flex-1 font-mono text-2xl tabular-nums")}
          />
          <button type="submit" className={cx(buttonClass("primary"), "h-14 px-6 text-base")}>
            {t("log.open")}
          </button>
        </div>
        {typed && (
          <p id="pond-number-error" className="mt-2 text-sm text-danger">
            {t("log.pondNotFound", { n: typed })}
          </p>
        )}
      </form>

      <section aria-labelledby="progress-heading" className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h1 id="progress-heading" className="text-lg font-semibold text-ink">
            {t("nav.ponds")}
          </h1>
          <p className="text-sm tabular-nums text-ink-2">
            <span className="font-semibold text-ink">{done}</span> {t("log.ofLogged", { total: ponds.length })}
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${ponds.length ? (done / ponds.length) * 100 : 0}%` }}
          />
        </div>
      </section>

      {ponds.length > LIST_LIMIT ? (
        <PondGrid ponds={ponds} date={date} labels={{ done: t("log.legendDone"), todo: t("log.legendTodo") }} />
      ) : (
        <ul className="space-y-2.5">
          {ponds.map(({ pond, today: entry, previous, cycle }) => (
            <li key={pond.id}>
              <Link
                href={`/log/${pond.id}?date=${date}`}
                className={cx(
                  "flex items-center gap-4 rounded-lg border bg-surface p-4 transition-colors active:bg-surface-2",
                  entry ? "border-line" : "border-line hover:border-brand/40",
                )}
              >
                <span
                  className={cx(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    entry ? "bg-positive-soft text-positive" : "bg-surface-3 text-ink-3",
                  )}
                >
                  {entry ? <CheckIcon className="size-5" strokeWidth={2.4} /> : <CircleIcon className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">{pond.name}</span>
                  <span className="mt-0.5 block truncate text-sm text-ink-3">
                    {entry ? (
                      <>
                        {entry.bags > 0 ? `${entry.feedType?.code} · ${fmt.bags(entry.bags)}` : t("log.noFeeding")}
                        {" · "}
                        {t("log.deadCount", { n: formatNumber(entry.deadCount, 0) })}
                        {entry.recordedBy && ` · ${t("log.by", { name: entry.recordedBy })}`}
                      </>
                    ) : cycle.state === "empty" ? (
                      <span className={cycle.lastOutcome === "lost" ? "text-danger" : undefined}>
                        {t("log.emptySince", { date: fmt.dayKey(cycle.since, { year: false }) })}
                      </span>
                    ) : previous ? (
                      <>
                        {t("log.last", {
                          what: previous.bags > 0 ? `${previous.feedType?.code} · ${fmt.bags(previous.bags)}` : t("log.noFeeding"),
                          date: fmt.day(previous.date, { year: false }),
                        })}
                      </>
                    ) : (
                      t("log.noRecords")
                    )}
                  </span>
                </span>
                <span
                  className={cx(
                    "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold",
                    entry ? "text-ink-3" : "bg-brand text-brand-ink",
                  )}
                >
                  {entry ? t("log.edit") : t("log.log")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {ponds.length === 0 && (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-3">
          {t("log.noPonds")}
        </p>
      )}
    </>
  );
}

// Every pond as a numbered tile, grouped by farm: green once logged for the
// day. Tapping one opens it, like typing its number.
function PondGrid({
  ponds,
  date,
  labels,
}: {
  ponds: LogDayData["ponds"];
  date: string;
  labels: { done: string; todo: string };
}) {
  const farms = new Map<string, typeof ponds>();
  for (const entry of ponds) {
    const name = entry.farm ?? "";
    farms.set(name, [...(farms.get(name) ?? []), entry]);
  }
  return (
    <div className="space-y-5">
      <ul className="flex gap-4 text-xs text-ink-3" aria-hidden="true">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-positive" />
          {labels.done}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-line-strong" />
          {labels.todo}
        </li>
      </ul>
      {[...farms].map(([farm, entries]) => (
        <section key={farm} aria-label={farm || undefined}>
          {farm && (
            <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-ink">
              {farm}
              <span className="font-mono text-xs font-normal text-ink-3 tabular-nums">
                {entries.filter((entry) => entry.today).length}/{entries.length}
              </span>
            </h2>
          )}
          <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
            {entries.map(({ pond, today: entry, cycle }) => (
              <li key={pond.id}>
                <Link
                  href={`/log/${pond.id}?date=${date}`}
                  title={pond.name}
                  aria-label={`${pond.name}: ${entry ? labels.done : labels.todo}`}
                  className={cx(
                    "flex h-11 items-center justify-center rounded-md border font-mono text-sm font-medium tabular-nums transition-colors",
                    entry
                      ? "border-positive/30 bg-positive-soft text-positive"
                      : cycle.state === "empty"
                        ? "border-dashed border-line text-ink-3"
                        : "border-line-strong bg-surface text-ink hover:border-brand",
                  )}
                >
                  {pondNumber(pond.name) ?? pond.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
