import Link from "next/link";
import { cx } from "./ui";

// Previous / next links over a list, keeping the page's other query params.
export default function Pager({
  page,
  pages,
  href,
  labels,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  labels: { prev: string; next: string; range: string };
}) {
  if (pages <= 1) return null;
  const button = "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-3">
      <span className="tabular-nums">{labels.range}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} scroll={false} className={cx(button, "border-line bg-surface text-ink-2 hover:border-line-strong")}>
            {labels.prev}
          </Link>
        ) : (
          <span className={cx(button, "border-line text-ink-3 opacity-50")}>{labels.prev}</span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} scroll={false} className={cx(button, "border-line bg-surface text-ink-2 hover:border-line-strong")}>
            {labels.next}
          </Link>
        ) : (
          <span className={cx(button, "border-line text-ink-3 opacity-50")}>{labels.next}</span>
        )}
      </div>
    </div>
  );
}
