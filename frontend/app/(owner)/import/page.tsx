"use client";

import { PageHeader } from "@/app/components/ui";
import { useI18n } from "@/app/components/I18nProvider";
import { Api, useTitle } from "@/app/components/Api";
import type { importData } from "@backend/lib/pages";
import { useSearchParams } from "next/navigation";
import ImportForm from "./ImportForm";

type ImportData = Awaited<ReturnType<typeof importData>>;

export default function ImportPage() {
  return <Api<ImportData> path="/import">{(data) => <ImportScreen data={data} />}</Api>;
}

function ImportScreen({ data }: { data: ImportData }) {
  const { ponds, feedTypes } = data;
  const pond = useSearchParams().get("pond");
  const { t } = useI18n();
  useTitle(t("pond.importSpreadsheet"));

  return (
    <>
      <PageHeader
        eyebrow={t("import.eyebrow")}
        title={t("import.title")}
        description={t("import.description")}
      />
      <ImportForm
        ponds={ponds.map((entry) => ({ id: entry.id, name: entry.name, records: entry._count.dailyLogs }))}
        catalog={feedTypes}
        defaultPondId={pond ? Number(pond) : null}
      />
    </>
  );
}
