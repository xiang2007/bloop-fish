"use client";

import Link from "next/link";
import type { getPondDetail } from "@backend/lib/queries";
import { formatAbw, formatKg, formatRm } from "@fisheye/shared/format";
import type { Finding } from "@fisheye/shared/import/pondReport";
import { deleteImportBatch, deleteSampling } from "@/lib/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import { AlertIcon, CheckCircleIcon, DownloadIcon, FileIcon, InfoIcon, UploadIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, EmptyState, buttonClass, cx } from "@/app/components/ui";
import { useI18n } from "@/app/components/I18nProvider";

type Detail = NonNullable<Awaited<ReturnType<typeof getPondDetail>>>;

export default function PondData({ detail }: { detail: Detail }) {
  const { t, fmt } = useI18n();
  const { pond, imports, samplings, logs } = detail;
  const appLogs = logs.filter((log) => log.source === "app").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SourceCard label={t("data.fromSheets")} value={logs.length - appLogs} detail={t("data.imports", { n: imports.length })} />
        <SourceCard label={t("data.inApp")} value={appLogs} detail={t("data.inAppDetail")} />
        <SourceCard label={t("data.samples")} value={samplings.length} detail={t("data.samplesDetail")} />
      </div>

      {imports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileIcon className="size-5" />}
            title={t("data.noImport")}
            description={t("data.noImportDescription")}
            action={
              <Link href={`/import?pond=${pond.id}`} className={buttonClass("primary")}>
                <UploadIcon className="size-4" />
                {t("pond.importSpreadsheet")}
              </Link>
            }
          />
        </Card>
      ) : (
        imports.map((batch) => <ImportCard key={batch.id} batch={batch} />)
      )}

      <Card>
        <CardHeader
          title={t("data.samplingHistory")}
          description={t("data.samplingDescription")}
          action={
            logs.length > 0 ? (
              <a href={`/ponds/${pond.id}/export`} className={buttonClass("secondary", "sm")}>
                <DownloadIcon className="size-3.5" />
                {t("data.export")}
              </a>
            ) : undefined
          }
        />
        {samplings.length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-sm text-ink-3">{t("data.noSamples")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-3">
                  <th className="px-5 py-2.5 font-medium">{t("harvests.col.date")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("pond.averageWeight")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("pond.fishWeighed")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("data.source")}</th>
                  <th className="w-16 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {[...samplings].reverse().map((sampling) => (
                  <tr key={sampling.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5 text-ink-2">{fmt.day(sampling.date)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink">{formatAbw(sampling.avgWeightKg)}</td>
                    <td className="px-3 py-2.5 text-right text-ink-2">{sampling.sampleSize ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {sampling.source === "import" ? <Badge>{t("records.spreadsheet")}</Badge> : <Badge tone="brand">{sampling.recordedBy ?? t("records.app")}</Badge>}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <ConfirmButton
                        action={deleteSampling}
                        fields={{ id: String(sampling.id) }}
                        message={t("data.deleteSampleConfirm", { date: fmt.day(sampling.date) })}
                        label={t("data.deleteSample")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SourceCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card as="div" className="p-5">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString("en-MY")}</p>
      <p className="mt-1 text-xs text-ink-3">{detail}</p>
    </Card>
  );
}

function ImportCard({ batch }: { batch: Detail["imports"][number] }) {
  const { t, fmt } = useI18n();
  const warnings = batch.findings.filter((finding) => finding.severity !== "info");
  const notes = batch.findings.filter((finding) => finding.severity === "info");

  return (
    <Card>
      <CardHeader
        icon={<FileIcon className="size-4" />}
        title={batch.fileName}
        description={t("data.importedSummary", {
          date: fmt.day(batch.importedAt),
          days: batch.summary.totals.days,
          feed: formatKg(batch.summary.totals.feedKg, 0),
          cost: formatRm(batch.summary.totals.feedCostRm, 0),
        })}
        action={
          <ConfirmButton
            action={deleteImportBatch}
            fields={{ id: String(batch.id) }}
            message={t("data.removeConfirm")}
            label={t("data.remove")}
          >
            {t("data.remove")}
          </ConfirmButton>
        }
      />
      <div className="px-5 pt-4 pb-5">
        <div
          className={cx(
            "mb-4 flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
            warnings.length > 0 ? "bg-warning-soft text-warning" : "bg-positive-soft text-positive",
          )}
        >
          {warnings.length > 0 ? <AlertIcon className="mt-0.5 size-4 shrink-0" /> : <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />}
          <p className="text-pretty">
            {warnings.length > 0
              ? t("data.inconsistencies", { n: warnings.length })
              : t("data.allMatched")}
          </p>
        </div>
        <FindingList findings={warnings} />
        {notes.length > 0 && (
          <details className="group mt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-2 hover:text-ink">
              {t("data.notes", { n: notes.length })}
            </summary>
            <div className="mt-3">
              <FindingList findings={notes} />
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}

function FindingList({ findings }: { findings: Finding[] }) {
  const { fmt } = useI18n();
  if (findings.length === 0) return null;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
      {findings.map((finding, index) => (
        <li key={index} className="flex items-start gap-3 px-4 py-3">
          <span
            className={cx(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
              finding.severity === "info" ? "bg-info-soft text-info" : "bg-warning-soft text-warning",
            )}
          >
            {finding.severity === "info" ? <InfoIcon className="size-3.5" /> : <AlertIcon className="size-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{finding.title}</p>
            <p className="mt-0.5 text-pretty text-sm text-ink-3">{finding.detail}</p>
          </div>
          {finding.monthKey && <Badge className="shrink-0">{fmt.month(finding.monthKey)}</Badge>}
        </li>
      ))}
    </ul>
  );
}
