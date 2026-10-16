import type { ReactNode } from "react";
import { TrendDownIcon, TrendUpIcon } from "./icons";
import { AnimatedTabs, CountUp } from "./motion";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const SERIES_COUNT = 8;

// Stable colour per feed type so a type looks the same on every chart.
export function feedColor(feedTypeId: number | null | undefined) {
  if (!feedTypeId) return "var(--ink-3)";
  return `var(--series-${((feedTypeId - 1) % SERIES_COUNT) + 1})`;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:active:scale-100",
    size === "sm" && "h-8 px-3 text-xs",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-base",
    variant === "primary" && "bg-brand text-brand-ink hover:bg-brand-strong",
    variant === "secondary" &&
      "border border-line-strong bg-surface text-ink hover:bg-surface-2",
    variant === "ghost" && "text-ink-2 hover:bg-surface-3 hover:text-ink",
    variant === "danger" && "border border-line bg-surface text-danger hover:bg-danger-soft",
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink tabular-nums placeholder:text-ink-3 hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cx(
        "rounded-lg border border-line bg-surface",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Accepted for older call sites; headers no longer show an icon. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    // Wraps so a wide action (e.g. a long legend) drops below the title on
    // narrow screens instead of squeezing it.
    <div className={cx("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5", className)}>
      <div className="min-w-0 flex-[1_1_14rem]">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-pretty text-[13px] text-ink-3">{description}</p>}
      </div>
      {action && <div className="flex max-w-full min-w-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 font-mono text-xs tracking-wide text-ink-3 uppercase">{eyebrow}</div>}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-pretty text-sm text-ink-2">{description}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type Tone = "neutral" | "brand" | "positive" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  brand: "bg-brand-soft text-brand",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StatChange = { value: number; label: string; goodWhen: "up" | "down" };

function ChangeLine({ change, sub }: { change?: StatChange | null; sub?: ReactNode }) {
  const isUp = change ? change.value >= 0 : false;
  const isGood = change ? (change.goodWhen === "up" ? isUp : !isUp) : false;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
      {change && Number.isFinite(change.value) && (
        <span className={cx("inline-flex items-center gap-0.5 font-medium", isGood ? "text-positive" : "text-danger")}>
          {isUp ? <TrendUpIcon className="size-3.5" /> : <TrendDownIcon className="size-3.5" />}
          {`${isUp ? "+" : ""}${(change.value * 100).toFixed(1)}%`}
        </span>
      )}
      {change && <span>{change.label}</span>}
      {sub && <span>{sub}</span>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  sub,
  change,
  emphasis = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  /** Accepted for older call sites; stat cards no longer show an icon. */
  icon?: ReactNode;
  change?: StatChange | null;
  emphasis?: boolean;
}) {
  return (
    <Card as="div" className={cx("relative overflow-hidden p-5", emphasis && "border-t-[3px] border-t-brand")}>
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="mt-2.5 text-[28px] leading-none font-semibold tracking-tight tabular-nums text-ink">
        <CountUp value={value} />
        {unit && <span className="ml-1 text-sm font-medium text-ink-3">{unit}</span>}
      </p>
      <ChangeLine change={change} sub={sub} />
    </Card>
  );
}

// One stat card split down the middle into two related figures.
export function SplitStatCard({
  label,
  halves,
}: {
  label: string;
  halves: [SplitHalf, SplitHalf];
}) {
  return (
    <Card as="div" className="relative overflow-hidden p-5">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <div className="mt-2.5 grid grid-cols-2 divide-x divide-line">
        {halves.map((half, index) => (
          <div key={index} className={cx("min-w-0", index === 0 ? "pr-4" : "pl-4")}>
            <p className="truncate text-xs text-ink-3">{half.label}</p>
            <p className="mt-1.5 text-[22px] leading-none font-semibold tracking-tight tabular-nums text-ink">
              <CountUp value={half.value} />
            </p>
            <ChangeLine change={half.change} sub={half.sub} />
          </div>
        ))}
      </div>
    </Card>
  );
}

type SplitHalf = { label: string; value: string; sub?: ReactNode; change?: StatChange | null };

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-3 text-ink-3">
          {icon}
        </span>
      )}
      <h3 className="mt-4 text-balance font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-pretty text-sm text-ink-3">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function Tabs({
  items,
  active,
  label = "Sections",
}: {
  items: { key: string; label: string; href: string; count?: number }[];
  active: string;
  label?: string;
}) {
  return <AnimatedTabs items={items} active={active} label={label} />;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
