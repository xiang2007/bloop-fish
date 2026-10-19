"use client";

import { useState } from "react";
import { useI18n } from "@/app/components/I18nProvider";
import { cx } from "@/app/components/ui";
import LineChart, { type LinePoint } from "./LineChart";

const RANGES = [
  { days: 30, labelEvery: 7, key: "pond.range30" },
  { days: 90, labelEvery: 21, key: "pond.range90" },
  { days: null, labelEvery: null, key: "pond.rangeAll" },
] as const;

/**
 * A daily line chart for narrow screens: a whole cycle of daily points is
 * packed into a pixel or two each on a phone, so this shows the most recent days and lets the
 * reader widen the window. Short windows are labelled by date rather than by
 * month, counting back from the latest day so it always has a label.
 */
export default function RecentLineChart({
  data,
  dayLabels,
  height = 220,
  unit,
  ariaLabel,
}: {
  data: LinePoint[];
  /** Short date label for each point, same order as `data`. */
  dayLabels: string[];
  height?: number;
  unit?: string;
  ariaLabel: string;
}) {
  const { t } = useI18n();
  const [rangeIndex, setRangeIndex] = useState(0);
  const range = RANGES[rangeIndex];

  const start = range.days === null ? 0 : Math.max(data.length - range.days, 0);
  const shown = data.slice(start).map((point, offset) => {
    if (range.labelEvery === null) return point;
    const fromEnd = data.length - 1 - (start + offset);
    return { ...point, label: fromEnd % range.labelEvery === 0 ? dayLabels[start + offset] : "" };
  });

  return (
    <div>
      <div role="group" className="mb-2 flex gap-1 px-2">
        {RANGES.map((option, index) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={index === rangeIndex}
            onClick={() => setRangeIndex(index)}
            className={cx(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              index === rangeIndex ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-2 hover:text-ink",
            )}
          >
            {t(option.key)}
          </button>
        ))}
      </div>
      <LineChart points={shown} unit={unit} height={height} minLabelSpacing={40} ariaLabel={ariaLabel} />
    </div>
  );
}
