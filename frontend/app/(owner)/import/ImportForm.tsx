"use client";

import { useActionState, useRef, useState } from "react";
import { importSpreadsheet } from "@/lib/actions";
import type { FormState } from "@/lib/actions";
import { checkCsvFile, decodeCsv } from "@fisheye/shared/import/validate";
import { PondReportError, parsePondReport } from "@fisheye/shared/import/pondReport";
import { buildImportPlan, type FeedCatalogEntry, type ImportPlan } from "@fisheye/shared/import/plan";
import { formatNumber, formatRm } from "@fisheye/shared/format";
import { AlertIcon, CheckCircleIcon, FileIcon, InfoIcon, UploadIcon, XIcon } from "@/app/components/icons";
import { Badge, Card, CardHeader, Field, buttonClass, cx, inputClass } from "@/app/components/ui";
import { useI18n } from "@/app/components/I18nProvider";

type PondOption = { id: number; name: string; records: number };

export default function ImportForm({
  ponds,
  catalog,
  defaultPondId,
}: {
  ponds: PondOption[];
  catalog: FeedCatalogEntry[];
  defaultPondId: number | null;
}) {
  const { t, fmt } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(importSpreadsheet, { status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<string>(
    defaultPondId && ponds.some((pond) => pond.id === defaultPondId) ? String(defaultPondId) : "",
  );
  const [newPondName, setNewPondName] = useState("");

  async function readFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    setPlan(null);
    try {
      const wrongKind = checkCsvFile(file);
      const decoded = wrongKind ? { rejected: wrongKind } : decodeCsv(new Uint8Array(await file.arrayBuffer()));
      if ("rejected" in decoded) {
        setParseError(t(decoded.rejected === "unsafe" ? "error.csvUnsafe" : "error.notCsv"));
        return;
      }
      const parsed = parsePondReport(decoded.text);
      setPlan(buildImportPlan(parsed, catalog));
    } catch (error) {
      setParseError(error instanceof PondReportError ? error.message : t("error.readCsv"));
    }

    // Suggest a target pond from the file name, e.g. "Pond 1 - ....csv".
    if (!target) {
      const match = file.name.match(/pond\s*(\d+)/i);
      const byName = match ? ponds.find((pond) => pond.name.toLowerCase() === `pond ${match[1]}`) : undefined;
      setTarget(byName ? String(byName.id) : "new");
      if (!byName) setNewPondName(match ? `Pond ${match[1]}` : "");
    }
  }

  function clearFile() {
    if (inputRef.current) inputRef.current.value = "";
    setFileName(null);
    setPlan(null);
    setParseError(null);
  }

  const warnings = plan?.findings.filter((finding) => finding.severity !== "info") ?? [];
  const notes = plan?.findings.filter((finding) => finding.severity === "info") ?? [];
  const targetPond = ponds.find((pond) => String(pond.id) === target);
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <label
          htmlFor="file"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file && inputRef.current) {
              const transfer = new DataTransfer();
              transfer.items.add(file);
              inputRef.current.files = transfer.files;
              void readFile(file);
            }
          }}
          className={cx(
            "m-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : "border-line-strong hover:border-brand/60 hover:bg-surface-2",
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <UploadIcon className="size-5" />
          </span>
          {fileName ? (
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <FileIcon className="size-4 text-ink-3" />
              {fileName}
            </span>
          ) : (
            <>
              <span className="mt-4 text-sm font-semibold text-ink">{t("import.drop")}</span>
              <span className="mt-1 text-sm text-ink-3">{t("import.dropHint")}</span>
            </>
          )}
          <input
            ref={inputRef}
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </label>
        {fileName && (
          <div className="-mt-2 flex justify-center pb-5">
            <button type="button" onClick={clearFile} className={buttonClass("ghost", "sm")}>
              <XIcon className="size-3.5" />
              {t("import.differentFile")}
            </button>
          </div>
        )}
      </Card>

      {parseError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <p>{parseError}</p>
        </div>
      )}

      {plan && (
        <>
          <section aria-label={t("import.whatImported")} className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Summary label={t("import.months")} value={formatNumber(plan.totals.months, 0)} detail={`${fmt.month(plan.months[0].monthKey)} – ${fmt.month(plan.months.at(-1)!.monthKey)}`} />
            <Summary label={t("import.dailyRecords")} value={formatNumber(plan.totals.days, 0)} detail={t("import.samples", { n: formatNumber(plan.totals.samplings, 0) })} />
            <Summary label={t("entry.feed")} value={`${formatNumber(plan.totals.feedKg, 0)} kg`} detail={t("unit.bags", { n: formatNumber(plan.totals.bags, 1) })} />
            <Summary label={t("overview.feedCost")} value={formatRm(plan.totals.feedCostRm, 0)} detail={t("import.atSheetPrices")} />
            <Summary label={t("overview.deadFish")} value={formatNumber(plan.totals.deadCount, 0)} detail={t("import.fromDailyRows")} />
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader
                title={t("import.crossCheck")}
                description={warnings.length > 0 ? t("import.disagrees", { n: warnings.length }) : t("import.matches")}
                action={
                  warnings.length > 0 ? (
                    <Badge tone="warning">{t("import.toReview", { n: warnings.length })}</Badge>
                  ) : (
                    <Badge tone="positive">{t("import.clean")}</Badge>
                  )
                }
              />
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {[...warnings, ...notes].map((finding, index) => (
                  <li key={index} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={cx(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                        finding.severity === "info" ? "bg-info-soft text-info" : "bg-warning-soft text-warning",
                      )}
                    >
                      {finding.severity === "info" ? <InfoIcon className="size-3.5" /> : <AlertIcon className="size-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{finding.title}</p>
                      <p className="mt-0.5 text-pretty text-sm text-ink-3">{finding.detail}</p>
                    </div>
                  </li>
                ))}
                {plan.findings.length === 0 && (
                  <li className="flex items-center gap-2 px-5 py-4 text-sm text-positive">
                    <CheckCircleIcon className="size-4" />
                    {t("import.noIssues")}
                  </li>
                )}
              </ul>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title={t("import.into")} />
                <div className="space-y-4 p-5">
                  <Field label={t("table.pond")} htmlFor="target" hint={errors.target}>
                    <select
                      id="target"
                      name="target"
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="" disabled>
                        {t("error.choosePond")}
                      </option>
                      {ponds.map((pond) => (
                        <option key={pond.id} value={pond.id}>
                          {pond.name}
                          {pond.records > 0 ? ` (${t("settings.records", { n: pond.records })})` : ""}
                        </option>
                      ))}
                      <option value="new">{t("import.newPond")}</option>
                    </select>
                  </Field>
                  {target === "new" && (
                    <>
                      <Field label={t("import.newPondName")} htmlFor="newPondName" hint={errors.newPondName}>
                        <input
                          id="newPondName"
                          name="newPondName"
                          value={newPondName}
                          onChange={(event) => setNewPondName(event.target.value)}
                          maxLength={40}
                          required
                          className={cx(inputClass, errors.newPondName && "border-danger")}
                        />
                      </Field>
                      <Field label={t("import.speciesOptional")} htmlFor="species">
                        <input id="species" name="species" maxLength={60} className={inputClass} />
                      </Field>
                    </>
                  )}
                  {targetPond && targetPond.records > 0 && (
                    <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info">
                      {t("import.alreadyHas", { pond: targetPond.name, n: targetPond.records })}
                    </p>
                  )}
                  {state.status === "error" && !state.fieldErrors && (
                    <p role="alert" className="text-sm text-danger">
                      {state.message}
                    </p>
                  )}
                  <button type="submit" disabled={pending || !target} className={`${buttonClass("primary")} w-full`}>
                    {pending ? t("import.importing") : t("import.submit", { n: formatNumber(plan.totals.days, 0) })}
                  </button>
                </div>
              </Card>

              <Card>
                <CardHeader title={t("import.byMonth")} />
                <table className="mt-3 w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-y border-line bg-surface-2 text-right text-xs text-ink-3">
                      <th className="px-5 py-2 text-left font-medium">{t("pond.col.month")}</th>
                      <th className="px-2 py-2 font-medium">{t("pond.col.bags")}</th>
                      <th className="px-2 py-2 font-medium">{t("pond.col.cost")}</th>
                      <th className="px-5 py-2 font-medium">{t("table.dead")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.months.map((month) => (
                      <tr key={month.monthKey} className="border-b border-line text-right text-ink-2 last:border-0">
                        <td className="px-5 py-2 text-left text-ink">
                          {fmt.month(month.monthKey)} <span className="text-xs text-ink-3">M{month.cultureMonth}</span>
                        </td>
                        <td className="px-2 py-2">{formatNumber(month.bags, 1)}</td>
                        <td className="px-2 py-2">{formatRm(month.feedCostRm, 0)}</td>
                        <td className="px-5 py-2">{month.deadCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card as="div" className="p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-3">{detail}</p>
    </Card>
  );
}
