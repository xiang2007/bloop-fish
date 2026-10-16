"use client";

import { useId, useState } from "react";
import { ChartTooltip, formatTick, niceScale, useChartWidth, type TooltipContent } from "./useChartWidth";

export type LinePoint = {
  key: string;
  label: string;
  /** Null leaves a gap in the line (e.g. a day with nothing recorded). */
  value: number | null;
  /** Dot colour for this point; defaults to the line colour. */
  color?: string;
  tooltip: TooltipContent;
};

const PAD = { top: 24, right: 16, bottom: 26, left: 44 };

export default function LineChart({
  points,
  height = 240,
  ariaLabel,
  unit,
  color = "var(--series-1)",
  area = true,
  minLabelSpacing,
}: {
  points: LinePoint[];
  height?: number;
  ariaLabel: string;
  unit?: string;
  color?: string;
  area?: boolean;
  /** Draw every non-empty label at least this far apart, instead of every Nth point. */
  minLabelSpacing?: number;
}) {
  const { ref, width } = useChartWidth();
  const [active, setActive] = useState<number | null>(null);

  const { max, ticks } = niceScale(Math.max(...points.map((point) => point.value ?? 0), 0));
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = height - PAD.top - PAD.bottom;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const x = (index: number) => PAD.left + (points.length > 1 ? index * step : plotWidth / 2);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;
  const labelEvery = Math.max(1, Math.ceil(44 / Math.max(step, 1)));
  const shownLabels = new Set<number>();
  for (let index = 0; index < points.length; index++) {
    if (!points[index].label) continue;
    if (minLabelSpacing === undefined) {
      if (index % labelEvery === 0) shownLabels.add(index);
    } else if (![...shownLabels].some((other) => x(index) - x(other) < minLabelSpacing)) {
      shownLabels.add(index);
    }
  }
  const dotRadius = Math.min(Math.max(step * 0.4, 1.75), 3.25);

  const line = points
    .map((point, index) => {
      if (point.value === null) return "";
      const penDown = index > 0 && points[index - 1].value !== null;
      return `${penDown ? "L" : "M"}${x(index)},${y(point.value)}`;
    })
    .join(" ");
  // One shaded area per unbroken run of points, so gaps stay empty.
  const runs: number[][] = [];
  points.forEach((point, index) => {
    if (point.value === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === index - 1) last.push(index);
    else runs.push([index]);
  });
  const areaPath = area
    ? runs
        .map((run) => {
          const top = run.map((index, i) => `${i === 0 ? "M" : "L"}${x(index)},${y(points[index].value!)}`).join(" ");
          return `${top} L${x(run[run.length - 1])},${PAD.top + plotHeight} L${x(run[0])},${PAD.top + plotHeight} Z`;
        })
        .join(" ")
    : "";
  const gradientId = `area-${useId().replace(/\W+/g, "")}`;

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setActive(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink-3 text-[10.5px] tabular-nums"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {unit && (
          <text x={4} y={10} textAnchor="start" className="fill-ink-3 text-[10.5px] font-medium">
            {unit}
          </text>
        )}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plotHeight}
          y2={PAD.top + plotHeight}
          stroke="var(--axis)"
        />
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={PAD.top + plotHeight}
            stroke="var(--line-strong)"
            strokeDasharray="3 3"
          />
        )}
        {points.map((point, index) => (
          <g key={point.key}>
            {point.value !== null && (
              <circle
                cx={x(index)}
                cy={y(point.value)}
                r={active === index ? Math.max(dotRadius + 1.75, 5) : dotRadius}
                fill="var(--surface)"
                stroke={point.color ?? color}
                strokeWidth={dotRadius < 3 ? 1.5 : 2}
              />
            )}
            {shownLabels.has(index) && (
              <text x={x(index)} y={height - 8} textAnchor="middle" className="fill-ink-3 text-[10.5px]">
                {point.label}
              </text>
            )}
            <rect
              x={x(index) - (step || 24) / 2}
              y={PAD.top}
              width={(step || 24)}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setActive(index)}
              onPointerDown={() => setActive(index)}
            />
          </g>
        ))}
      </svg>
      {active !== null && points[active] && (
        <ChartTooltip content={points[active].tooltip} x={x(active)} containerWidth={width} />
      )}
    </div>
  );
}
