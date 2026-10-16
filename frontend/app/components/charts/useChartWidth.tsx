"use client";

import { useEffect, useRef, useState } from "react";

export function useChartWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(Math.floor(entry.contentRect.width), 240));
      setHeight(Math.floor(entry.contentRect.height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width, height };
}

export function niceScale(maxValue: number, tickCount = 4) {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const rough = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  return { max, ticks };
}

export function formatTick(value: number) {
  if (value >= 1000) return `${(value / 1000).toLocaleString("en-MY", { maximumFractionDigits: 1 })}k`;
  return value.toLocaleString("en-MY", { maximumFractionDigits: 2 });
}

export type TooltipContent = {
  title: string;
  lines: { label: string; value: string; color?: string }[];
};

export function ChartTooltip({
  content,
  x,
  containerWidth,
}: {
  content: TooltipContent;
  x: number;
  containerWidth: number;
}) {
  const flip = x > containerWidth * 0.6;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={flip ? { right: containerWidth - x + 12 } : { left: x + 12 }}
    >
      <p className="mb-1 font-semibold text-ink">{content.title}</p>
      <ul className="space-y-0.5">
        {content.lines.map((line) => (
          <li key={line.label} className="flex items-center justify-between gap-4 text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              {line.color && <span className="size-2 rounded-[2px]" style={{ background: line.color }} />}
              {line.label}
            </span>
            <span className="font-medium tabular-nums text-ink">{line.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
