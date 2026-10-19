"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/icons";
import { cx, inputClass } from "@/app/components/ui";

export default function ReportPicker({
  ponds,
  pond,
  months,
  month,
}: {
  ponds: { id: number; name: string }[];
  pond: string;
  months: { key: string; label: string }[];
  month: string;
}) {
  const router = useRouter();
  const index = months.findIndex((entry) => entry.key === month);
  const href = (nextPond: string, nextMonth: string) => `/reports?pond=${nextPond}&month=${nextMonth}`;
  const previous = months[index - 1];
  const next = months[index + 1];
  const arrow = "flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-2";

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <label htmlFor="report-pond" className="sr-only">
        Pond
      </label>
      <select
        id="report-pond"
        value={pond}
        onChange={(event) => router.push(href(event.target.value, month), { scroll: false })}
        className={cx(inputClass, "w-40 font-medium")}
      >
        <option value="all">All ponds</option>
        {ponds.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        {previous ? (
          <Link href={href(pond, previous.key)} scroll={false} className={cx(arrow, "hover:bg-surface-2")} aria-label={`Previous month, ${previous.label}`}>
            <ChevronLeftIcon className="size-4" />
          </Link>
        ) : (
          <span className={cx(arrow, "opacity-40")} aria-hidden="true">
            <ChevronLeftIcon className="size-4" />
          </span>
        )}
        <label htmlFor="report-month" className="sr-only">
          Month
        </label>
        <select
          id="report-month"
          value={month}
          onChange={(event) => router.push(href(pond, event.target.value), { scroll: false })}
          className={cx(inputClass, "w-44 font-medium")}
        >
          {months.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </select>
        {next ? (
          <Link href={href(pond, next.key)} scroll={false} className={cx(arrow, "hover:bg-surface-2")} aria-label={`Next month, ${next.label}`}>
            <ChevronRightIcon className="size-4" />
          </Link>
        ) : (
          <span className={cx(arrow, "opacity-40")} aria-hidden="true">
            <ChevronRightIcon className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}

export function PrintButton({ className }: { className: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Print / PDF
    </button>
  );
}
