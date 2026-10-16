"use client";

import { useState } from "react";
import { ChartTooltip, formatTick, niceScale, useChartWidth, type TooltipContent } from "./useChartWidth";

export type BarDatum = {
  key: string;
  label: string;
  segments: { name: string; value: number; color: string }[];
  tooltip: TooltipContent;
};

const PAD = { top: 24, right: 8, bottom: 26, left: 44 };

export default function BarChart({
  data,
  height = 240,
  ariaLabel,
  unit,
  minLabelSpacing = 44,
  fill = false,
}: {
  data: BarDatum[];
  height?: number;
  ariaLabel: string;
  unit?: string;
  minLabelSpacing?: number;
  // Grow to the parent's height (parent must be a flex column), using
  // `height` as the minimum.
  fill?: boolean;
}) {
  const { ref, width, height: measured } = useChartWidth();
  const minHeight = height;
  height = fill ? Math.max(measured, minHeight) : height;
  const [active, setActive] = useState<number | null>(null);

  const totals = data.map((bar) => bar.segments.reduce((sum, segment) => sum + segment.value, 0));
  const { max, ticks } = niceScale(Math.max(...totals, 0));
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = height - PAD.top - PAD.bottom;
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(Math.min(slot * 0.68, 36), 1.5);
  const labelEvery = Math.max(1, Math.ceil(minLabelSpacing / slot));
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  return (
    <div
      ref={ref}
      className={fill ? "relative w-full flex-1" : "relative w-full"}
      style={fill ? { minHeight } : undefined}
      onMouseLeave={() => setActive(null)}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className={fill ? "absolute inset-0 block overflow-visible" : "block overflow-visible"}
      >
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

        {data.map((bar, index) => {
          const x = PAD.left + index * slot + (slot - barWidth) / 2;
          let stack = 0;
          const isActive = active === index;
          return (
            <g key={bar.key} opacity={active === null || isActive ? 1 : 0.45}>
              {bar.segments.map((segment, segmentIndex) => {
                if (segment.value <= 0) return null;
                const top = y(stack + segment.value);
                const bottom = y(stack);
                stack += segment.value;
                const isTop = segmentIndex === bar.segments.findLastIndex((s) => s.value > 0);
                return (
                  <rect
                    key={segment.name}
                    x={x}
                    y={top}
                    width={barWidth}
                    height={Math.max(bottom - top, 0.5)}
                    rx={isTop && barWidth > 6 ? 2.5 : 0}
                    fill={segment.color}
                  />
                );
              })}
              {index % labelEvery === 0 && (
                <text
                  x={PAD.left + index * slot + slot / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-ink-3 text-[10.5px]"
                >
                  {bar.label}
                </text>
              )}
              <rect
                x={PAD.left + index * slot}
                y={PAD.top}
                width={slot}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setActive(index)}
                onPointerDown={() => setActive(index)}
              />
            </g>
          );
        })}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plotHeight}
          y2={PAD.top + plotHeight}
          stroke="var(--axis)"
        />
      </svg>
      {active !== null && data[active] && (
        <ChartTooltip
          content={data[active].tooltip}
          x={PAD.left + active * slot + slot / 2}
          containerWidth={width}
        />
      )}
    </div>
  );
}
