"use client";

import Link from "next/link";
import { dateToDayKey, daysBetween, isDayKey, todayKey } from "@fisheye/shared/dates";
import { formatAbw } from "@fisheye/shared/format";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { logEntryData } from "@backend/lib/pages";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeftIcon } from "../../components/icons";
import DailyEntryForm from "./DailyEntryForm";
import SamplingForm from "./SamplingForm";

type LogEntryData = Awaited<ReturnType<typeof logEntryData>>;

export default function PondEntryPage() {
  const pondId = Number(useParams<{ pondId: string }>().pondId);
  const query = useSearchParams();
  const today = todayKey();
  const requested = query.get("date") ?? today;
  const date = isDayKey(requested) && requested <= today ? requested : today;
  const requestedReturn = query.get("returnTo") ?? "";
  const returnTo = requestedReturn.startsWith("/ponds/") ? requestedReturn : "";
  return (
    <Api<NonNullable<LogEntryData>> path={`/log/ponds/${pondId}?date=${date}`}>
      {(data) => <PondEntry data={data} date={date} returnTo={returnTo} />}
    </Api>
  );
}

function PondEntry({ data, date, returnTo }: { data: NonNullable<LogEntryData>; date: string; returnTo: string }) {
  const { t, fmt } = useI18n();
  const today = todayKey();
  const { pond, feedTypes, session, previous } = data;
  useTitle(t("log.logPond", { pond: pond.name }));

  const existing = pond.dailyLogs.find((log) => dateToDayKey(log.date) === date) ?? null;
  const history = pond.dailyLogs.filter((log) => dateToDayKey(log.date) < date);
  const lastFeedTypeId =
    history.find((log) => log.feedTypeId && log.bags > 0)?.feedTypeId ?? previous?.feedTypeId ?? null;

  const lastSampling = pond.samplings[0] ?? null;
  const daysSinceSampling = lastSampling ? daysBetween(dateToDayKey(lastSampling.date), date) : null;
  const dayOfCulture = pond.stockedAt ? daysBetween(dateToDayKey(pond.stockedAt), date) : null;
  const tooOldForWorker = session?.role === "worker" && daysBetween(date, today) > 7;

  return (
    <>
      <Link
        href={returnTo || `/log?date=${date}`}
        className="mb-4 inline-flex h-9 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-ink-2 hover:text-ink"
      >
        <ChevronLeftIcon className="size-4" />
        {returnTo ? t("log.backToRecords") : t("log.allPonds")}
      </Link>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{pond.name}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {fmt.dayKey(date, { weekday: true })}
          {dayOfCulture !== null && dayOfCulture >= 0 && (
            <span className="text-ink-3"> · {t("log.dayOfCulture", { day: dayOfCulture })}</span>
          )}
        </p>
      </header>

      {tooOldForWorker ? (
        <p className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          {t("log.tooOld")}
        </p>
      ) : (
        <DailyEntryForm
          key={`${pond.id}-${date}`}
          pondId={pond.id}
          pondName={pond.name}
          date={date}
          returnTo={returnTo}
          feedTypes={feedTypes.map(({ id, code, packSizeKg, pricePerKg }) => ({ id, code, packSizeKg, pricePerKg }))}
          existing={
            existing
              ? {
                  feedTypeId: existing.feedTypeId,
                  bags: existing.bags,
                  deadCount: existing.deadCount,
                  note: existing.note,
                  recordedBy: existing.recordedBy,
                  source: existing.source,
                }
              : null
          }
          previous={
            previous
              ? {
                  date: dateToDayKey(previous.date),
                  feedTypeId: previous.feedTypeId,
                  feedCode: previous.feedType?.code ?? null,
                  bags: previous.bags,
                  feedKg: previous.feedKg,
                  deadCount: previous.deadCount,
                  note: previous.note,
                  recordedBy: previous.recordedBy,
                }
              : null
          }
          defaultFeedTypeId={lastFeedTypeId}
        />
      )}

      {!tooOldForWorker && (
        <SamplingForm
          pondId={pond.id}
          date={date}
          lastSampling={
            lastSampling
              ? {
                  label: t("log.sampleLabel", { abw: formatAbw(lastSampling.avgWeightKg), date: fmt.day(lastSampling.date) }),
                  daysAgo: daysSinceSampling ?? 0,
                }
              : null
          }
        />
      )}

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">{t("log.previous7")}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {history.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-ink-2">{fmt.day(log.date, { weekday: true, year: false })}</span>
                <span className="tabular-nums text-ink">
                  {log.bags > 0 ? `${log.feedType?.code} · ${fmt.bags(log.bags)}` : t("log.noFeeding")}
                  <span className="text-ink-3"> · {t("log.deadCount", { n: log.deadCount })}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
