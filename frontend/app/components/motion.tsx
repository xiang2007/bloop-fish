"use client";

// Motion patterns adapted for Fisheye from two MIT-licensed libraries:
// - SmoothUI (https://github.com/educlopez/smoothui), © 2024 Eduardo Calvo:
//   the sliding tab indicator (animated-tabs).
// - unlumen UI (https://github.com/leovvx/unlumen-ui-docs), © 2026 Léo Wicki:
//   the count-up number (count-up).
// Both honour prefers-reduced-motion.

import Link from "next/link";
import { animate, motion, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export const SPRING = { type: "spring" as const, bounce: 0.05, duration: 0.25 };

/**
 * Link tabs with an underline that slides to the chosen tab. The underline
 * moves as soon as a tab is clicked, before the server sends the new view.
 */
export function AnimatedTabs({
  items,
  active,
  label,
}: {
  items: { key: string; label: string; href: string; count?: number }[];
  active: string;
  label: string;
}) {
  const layoutId = useId();
  const reduceMotion = useReducedMotion();
  const [pending, setPending] = useState<{ key: string; from: string } | null>(null);
  const shown = pending && pending.from === active ? pending.key : active;

  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4 shadow-[inset_0_-1px_0_var(--line)] sm:mx-0 sm:px-0" aria-label={label}>
      <ul className="flex min-w-max gap-6">
        {items.map((item) => {
          const isShown = item.key === shown;
          return (
            <li key={item.key} className="relative">
              <Link
                href={item.href}
                scroll={false}
                aria-current={item.key === active ? "page" : undefined}
                onClick={() => setPending({ key: item.key, from: active })}
                className={cx(
                  "inline-flex h-11 items-center gap-2 text-sm font-medium transition-colors",
                  isShown ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={cx(
                      "rounded-full px-1.5 text-xs tabular-nums transition-colors",
                      isShown ? "bg-brand-soft text-brand" : "bg-surface-3 text-ink-3",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
              {isShown && (
                <motion.span
                  layoutId={layoutId}
                  transition={reduceMotion ? { duration: 0 } : SPRING}
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand"
                />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const NUMBER = /-?\d[\d,]*(\.\d+)?/;

/**
 * Counts the first number in an already-formatted value ("12,480", "1.35",
 * "RM 4,200") up from zero when it mounts, keeping the rest of the text and
 * the original decimals and thousands separators. The server-rendered HTML
 * holds the final value, so nothing is lost without JavaScript.
 */
export function CountUp({ value, duration = 0.9 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const element = ref.current;
    const match = value.match(NUMBER);
    if (!element || !match || reduceMotion) return;
    const target = Number(match[0].replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = match[1] ? match[1].length - 1 : 0;
    const grouped = match[0].includes(",");
    const before = value.slice(0, match.index);
    const after = value.slice(match.index! + match[0].length);
    const format = (current: number) =>
      before +
      current.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouped,
      }) +
      after;

    element.textContent = format(0);
    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (current) => {
        element.textContent = format(current);
      },
      onComplete: () => {
        element.textContent = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  // Screen readers get the final value once; the animated copy is hidden from
  // them. Keyed by value so React replaces the node rather than patching text
  // the animation has rewritten.
  return (
    <>
      <span className="sr-only">{value}</span>
      <span key={value} ref={ref} aria-hidden="true">
        {value}
      </span>
    </>
  );
}
