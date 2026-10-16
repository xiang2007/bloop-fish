// Static inline trend line; server-rendered, no interaction.
export default function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "var(--series-1)",
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  label: string;
}) {
  if (values.length < 2) {
    return <span className="text-xs text-ink-3">—</span>;
  }
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [index * step, height - 2 - (value / max) * (height - 4)]);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
