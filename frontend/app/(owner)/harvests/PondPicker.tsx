"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/components/I18nProvider";
import { CheckIcon, ChevronDownIcon } from "@/app/components/icons";
import { cx } from "@/app/components/ui";

export type PondOption = { id: number; name: string; farm: string | null; count: number };

// Pond filter for farms with too many ponds for a row of chips: a button that
// opens a searchable list.
export default function PondPicker({ ponds, total, selected }: { ponds: PondOption[]; total: number; selected: number | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = ponds.find((pond) => pond.id === selected) ?? null;
  // Ponds that have harvests come first, since those are the ones worth picking.
  const sorted = useMemo(() => [...ponds].sort((a, b) => Number(b.count > 0) - Number(a.count > 0)), [ponds]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((pond) => pond.name.toLowerCase().includes(needle) || pond.farm?.toLowerCase().includes(needle));
  }, [sorted, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (id: number | null) => {
    setOpen(false);
    setQuery("");
    router.push(id === null ? "/harvests" : `/harvests?pond=${id}`, { scroll: false });
  };

  return (
    <div
      ref={rootRef}
      className="relative mb-6 sm:max-w-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          "flex h-10 w-full items-center gap-2 rounded-lg border bg-surface px-3 text-left text-sm font-medium",
          current ? "border-brand text-brand" : "border-line text-ink hover:border-line-strong",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {current ? current.name : t("harvests.allPonds")}
          {current?.farm && <span className="font-normal text-ink-3"> · {current.farm}</span>}
        </span>
        <span className="tabular-nums text-ink-3">{current ? current.count : total}</span>
        <ChevronDownIcon className={cx("size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="border-b border-line p-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches.length > 0) {
                  event.preventDefault();
                  choose(matches[0].id);
                }
              }}
              placeholder={t("harvests.searchPonds")}
              aria-label={t("harvests.searchPonds")}
              className="h-9 w-full rounded-md border border-line bg-surface-2 px-3 text-base sm:text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
            />
          </div>
          <ul role="listbox" aria-label={t("harvests.filterPond")} className="max-h-72 overflow-y-auto overscroll-contain py-1">
            {!query.trim() && (
              <Option active={selected === null} onSelect={() => choose(null)} label={t("harvests.allPonds")} count={total} />
            )}
            {matches.map((pond) => (
              <Option
                key={pond.id}
                active={pond.id === selected}
                onSelect={() => choose(pond.id)}
                label={pond.name}
                sub={pond.farm}
                count={pond.count}
              />
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-3 text-sm text-ink-3">{t("harvests.noPondMatch", { query: query.trim() })}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Option({
  active,
  onSelect,
  label,
  sub,
  count,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
  sub?: string | null;
  count: number;
}) {
  return (
    <li role="option" aria-selected={active}>
      <button
        type="button"
        onClick={onSelect}
        className={cx(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2",
          active ? "font-medium text-brand" : "text-ink-2",
        )}
      >
        <CheckIcon className={cx("size-4 shrink-0", active ? "text-brand" : "invisible")} />
        <span className="min-w-0 flex-1 truncate">
          {label}
          {sub && <span className="text-xs text-ink-3"> · {sub}</span>}
        </span>
        <span className={cx("tabular-nums text-xs", count > 0 ? "text-ink-2" : "text-ink-3")}>{count}</span>
      </button>
    </li>
  );
}
