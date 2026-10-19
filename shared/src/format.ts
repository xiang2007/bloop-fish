export function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString("en-MY", { maximumFractionDigits });
}

export function formatKg(value: number, maximumFractionDigits = 1) {
  return `${formatNumber(value, maximumFractionDigits)} kg`;
}

export function formatRm(value: number, maximumFractionDigits = 2) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
    maximumFractionDigits,
  })}`;
}

// Average body weight is recorded in kg per tail but read in grams on farm.
export function formatAbw(avgWeightKg: number) {
  const grams = avgWeightKg * 1000;
  if (grams >= 1000) return `${formatNumber(avgWeightKg, 2)} kg`;
  return `${formatNumber(grams, grams < 1 ? 2 : grams < 10 ? 1 : 0)} g`;
}

export function formatBags(value: number) {
  return `${formatNumber(value, 1)} ${value === 1 ? "bag" : "bags"}`;
}

export function formatPercent(value: number, maximumFractionDigits = 1) {
  return `${formatNumber(value * 100, maximumFractionDigits)}%`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count, 0)} ${count === 1 ? singular : plural}`;
}
