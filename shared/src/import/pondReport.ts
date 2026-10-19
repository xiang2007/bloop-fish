import { parseCsv, parseSheetNumber } from "./csv";
import { addMonths, daysInMonth, formatMonth } from "../dates";

// Reads the "Fish Pond Performance Report" spreadsheet export: one block of
// columns per culture month (DATE / TYPE OF FISH FEED / QUANTITY / DEAD FISH),
// a feed-cost table under each block, and a monthly summary table at the top.
// Blocks are located by their labels, not fixed row numbers, so exports from
// other ponds with a different number of months parse the same way.

export type FindingSeverity = "error" | "warning" | "info";

export type Finding = {
  severity: FindingSeverity;
  title: string;
  detail: string;
  monthKey?: string;
};

export type ParsedDay = {
  date: string;
  feedCode: string | null;
  bags: number;
  deadCount: number;
};

export type CostTableLine = {
  feedCode: string;
  bags: number | null;
  weightKg: number | null;
  pricePerKg: number | null;
};

export type ParsedMonth = {
  cultureMonth: number;
  monthKey: string;
  label: string;
  days: ParsedDay[];
  reportedBags: number | null;
  reportedDead: number | null;
  costTable: CostTableLine[];
};

export type MonthlySummaryRow = {
  cultureMonth: number;
  deadCount: number | null;
  avgWeightKg: number | null;
  deadKg: number | null;
  feedCostRm: number | null;
};

export type ReportedTotals = {
  totalFeedKg: number | null;
  fcr: number | null;
  estimatedFishWeightKg: number | null;
  deadFishWeightKg: number | null;
  harvestWeightKg: number | null;
};

export type ParsedPondReport = {
  stockedMonthKey: string;
  months: ParsedMonth[];
  summaryRows: MonthlySummaryRow[];
  reportedTotals: ReportedTotals | null;
  findings: Finding[];
};

export class PondReportError extends Error {}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_LABEL = /^\s*([A-Za-z]{3,9})[\s-]*(\d{2}|\d{4})\s*\(\s*(\d+)\s*Month\s*\)/i;

export function normalizeFeedCode(value: string | undefined): string | null {
  const code = (value ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]+\d+[A-Z0-9]*$/.test(code) ? code : null;
}

function cell(grid: string[][], row: number, col: number): string {
  return grid[row]?.[col] ?? "";
}

function labelMonthKey(name: string, year: string): string | null {
  const month = MONTH_NAMES.indexOf(name.slice(0, 3).toLowerCase());
  if (month === -1) return null;
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  return `${fullYear}-${String(month + 1).padStart(2, "0")}`;
}

function findRow(grid: string[][], predicate: (row: string[]) => boolean, from = 0) {
  for (let r = from; r < grid.length; r++) {
    if (predicate(grid[r])) return r;
  }
  return -1;
}

export function parsePondReport(text: string): ParsedPondReport {
  const grid = parseCsv(text);
  const findings: Finding[] = [];

  // 1. Monthly block labels, e.g. "Dec-25 (0 Month)".
  const labelRow = findRow(grid, (row) => row.some((value) => MONTH_LABEL.test(value)));
  if (labelRow === -1) {
    throw new PondReportError(
      'No monthly feed log blocks found. Expected headings like "Dec-25 (0 Month)".',
    );
  }

  const labels = grid[labelRow]
    .map((value, col) => ({ value: value.trim(), col, match: value.match(MONTH_LABEL) }))
    .filter((entry): entry is typeof entry & { match: RegExpMatchArray } => entry.match !== null)
    .map(({ value, col, match }) => ({
      col,
      label: value,
      labelMonthKey: labelMonthKey(match[1], match[2]),
      cultureMonth: Number(match[3]),
    }));

  const anchor = labels.find((label) => label.labelMonthKey !== null);
  if (!anchor?.labelMonthKey) {
    throw new PondReportError("Could not read a calendar month from the monthly block headings.");
  }
  const stockedMonthKey = addMonths(anchor.labelMonthKey, -anchor.cultureMonth);

  // 2. Column headers row directly under the labels.
  const headerRow = findRow(
    grid,
    (row) => row.some((value) => value.trim().toUpperCase() === "DATE"),
    labelRow + 1,
  );
  if (headerRow === -1 || headerRow - labelRow > 3) {
    throw new PondReportError('Missing the "DATE / TYPE OF FISH FEED / QUANTITY / DEAD FISH" header row.');
  }
  const dateCols = grid[headerRow]
    .map((value, col) => (value.trim().toUpperCase() === "DATE" ? col : -1))
    .filter((col) => col !== -1);

  const costHeaderRows: number[] = [];
  grid.forEach((row, r) => {
    if (r > headerRow && row.some((value) => /^type of fish feed$/i.test(value.trim()))) {
      costHeaderRows.push(r);
    }
  });

  const months: ParsedMonth[] = [];

  for (const label of labels) {
    const dateCol = dateCols.filter((col) => col <= label.col).at(-1);
    if (dateCol === undefined) continue;

    const monthKey = addMonths(stockedMonthKey, label.cultureMonth);
    if (label.labelMonthKey && label.labelMonthKey !== monthKey) {
      findings.push({
        severity: "warning",
        monthKey,
        title: `Heading "${label.label}" is ${formatMonth(monthKey, "long")}`,
        detail: `Culture month ${label.cultureMonth} counted from stocking in ${formatMonth(stockedMonthKey, "long")} is ${formatMonth(monthKey, "long")}, but the heading says ${formatMonth(label.labelMonthKey, "long")}. Records were dated by culture month.`,
      });
    }

    const days: ParsedDay[] = [];
    let reportedBags: number | null = null;
    let reportedDead: number | null = null;
    let lastFeedCode: string | null = null;
    const missingQuantityDays: ParsedDay[] = [];

    for (let r = headerRow + 1; r < Math.min(grid.length, headerRow + 40); r++) {
      const dayValue = cell(grid, r, dateCol).trim();
      const typeValue = cell(grid, r, dateCol + 1);

      if (/total/i.test(typeValue) || /total/i.test(dayValue)) {
        reportedBags = parseSheetNumber(cell(grid, r, dateCol + 2));
        reportedDead = parseSheetNumber(cell(grid, r, dateCol + 3));
        break;
      }
      if (!/^\d{1,2}$/.test(dayValue)) continue;

      const day = Number(dayValue);
      const rawCode = typeValue.trim();
      const feedCode = normalizeFeedCode(rawCode);
      const bags = parseSheetNumber(cell(grid, r, dateCol + 2));
      const dead = parseSheetNumber(cell(grid, r, dateCol + 3));

      if (!feedCode && bags === null && dead === null && rawCode === "") continue;

      if (day < 1 || day > daysInMonth(monthKey)) {
        findings.push({
          severity: "warning",
          monthKey,
          title: `Skipped day ${day} in ${formatMonth(monthKey, "long")}`,
          detail: `${formatMonth(monthKey, "long")} has only ${daysInMonth(monthKey)} days, so the entry on row ${r + 1} was not imported.`,
        });
        continue;
      }

      const date = `${monthKey}-${String(day).padStart(2, "0")}`;

      if (rawCode !== "" && !feedCode) {
        findings.push({
          severity: "warning",
          monthKey,
          title: `Unrecognised feed type "${rawCode}" on ${date}`,
          detail: "The feed type was ignored; quantity and dead fish were still imported.",
        });
      }

      let resolvedCode = feedCode;
      if (!resolvedCode && bags !== null && bags > 0 && lastFeedCode) {
        resolvedCode = lastFeedCode;
        findings.push({
          severity: "info",
          monthKey,
          title: `Feed type assumed on ${date}`,
          detail: `${bags} bags were recorded without a feed type; used the previous day's ${lastFeedCode}.`,
        });
      }
      if (resolvedCode) lastFeedCode = resolvedCode;

      const parsedDay: ParsedDay = {
        date,
        feedCode: resolvedCode,
        bags: bags ?? 0,
        deadCount: Math.max(0, Math.round(dead ?? 0)),
      };
      if (resolvedCode && bags === null) missingQuantityDays.push(parsedDay);
      days.push(parsedDay);
    }

    // A feed type with a blank quantity is recoverable when the month total
    // accounts for exactly one such gap.
    const computedBags = days.reduce((sum, day) => sum + day.bags, 0);
    const gap = reportedBags !== null ? round(reportedBags - computedBags) : 0;
    if (missingQuantityDays.length === 1 && gap > 0) {
      const [day] = missingQuantityDays;
      day.bags = gap;
      findings.push({
        severity: "info",
        monthKey,
        title: `Filled missing quantity on ${day.date}`,
        detail: `${day.feedCode} was recorded with no quantity. The month total is ${formatNumberPlain(reportedBags ?? 0)} ${reportedBags === 1 ? "bag" : "bags"}, so ${formatNumberPlain(gap)} ${gap === 1 ? "bag was" : "bags were"} assigned to this day.`,
      });
    } else {
      for (const day of missingQuantityDays) {
        findings.push({
          severity: "warning",
          monthKey,
          title: `No quantity on ${day.date}`,
          detail: `${day.feedCode} was recorded with no quantity and could not be recovered from the month total. Imported as 0 bags.`,
        });
      }
    }

    const costTable = readCostTable(grid, costHeaderRows, dateCol);

    months.push({
      cultureMonth: label.cultureMonth,
      monthKey,
      label: label.label,
      days,
      reportedBags,
      reportedDead,
      costTable,
    });
  }

  if (months.length === 0) {
    throw new PondReportError("Monthly blocks were found but none had a DATE column.");
  }

  const summaryRows = readSummaryRows(grid);
  const reportedTotals = readReportedTotals(grid);

  for (const month of months) {
    const bags = round(month.days.reduce((sum, day) => sum + day.bags, 0));
    const dead = month.days.reduce((sum, day) => sum + day.deadCount, 0);
    const name = formatMonth(month.monthKey, "long");

    if (month.reportedBags !== null && round(month.reportedBags) !== bags) {
      findings.push({
        severity: "warning",
        monthKey: month.monthKey,
        title: `${name}: bag total does not match daily rows`,
        detail: `The sheet's total is ${formatNumberPlain(month.reportedBags)} bags, but the daily rows add up to ${formatNumberPlain(bags)}. The daily rows were imported.`,
      });
    }
    if (month.reportedDead !== null && month.reportedDead !== dead) {
      findings.push({
        severity: "warning",
        monthKey: month.monthKey,
        title: `${name}: dead fish total does not match daily rows`,
        detail: `The sheet's total is ${month.reportedDead}, but the daily rows add up to ${dead}. The daily rows were imported.`,
      });
    }

    const summary = summaryRows.find((row) => row.cultureMonth === month.cultureMonth);
    if (summary?.deadCount != null && summary.deadCount !== dead) {
      findings.push({
        severity: "warning",
        monthKey: month.monthKey,
        title: `${name}: summary table dead fish differs`,
        detail: `The dead fish summary lists ${summary.deadCount} for month ${month.cultureMonth}, but the daily rows add up to ${dead}.`,
      });
    }

    const loggedByCode = new Map<string, number>();
    for (const day of month.days) {
      if (day.feedCode) {
        loggedByCode.set(day.feedCode, round((loggedByCode.get(day.feedCode) ?? 0) + day.bags));
      }
    }
    const listedByCode = new Map<string, number>();
    for (const line of month.costTable) {
      listedByCode.set(line.feedCode, round((listedByCode.get(line.feedCode) ?? 0) + (line.bags ?? 0)));
    }
    const mismatched = [...new Set([...loggedByCode.keys(), ...listedByCode.keys()])].filter(
      (code) => (loggedByCode.get(code) ?? 0) !== (listedByCode.get(code) ?? 0),
    );
    if (month.costTable.length > 0 && mismatched.length > 0) {
      findings.push({
        severity: "warning",
        monthKey: month.monthKey,
        title: `${name}: feed cost table does not match daily rows`,
        detail: mismatched
          .map(
            (code) =>
              `${code}: cost table ${formatNumberPlain(listedByCode.get(code) ?? 0)} bags, daily rows ${formatNumberPlain(loggedByCode.get(code) ?? 0)} bags`,
          )
          .join("; ") + ". Feed cost was recalculated from the daily rows.",
      });
    }
  }

  const loggedCultureMonths = new Set(months.map((month) => month.cultureMonth));
  for (const row of summaryRows) {
    if (!loggedCultureMonths.has(row.cultureMonth) && row.avgWeightKg !== null) {
      findings.push({
        severity: "info",
        monthKey: addMonths(stockedMonthKey, row.cultureMonth),
        title: `Month ${row.cultureMonth} sample weight not imported`,
        detail: `The summary lists an average weight for month ${row.cultureMonth}, but that month has no daily records yet.`,
      });
    }
  }

  return { stockedMonthKey, months, summaryRows, reportedTotals, findings };
}

function readCostTable(grid: string[][], headerRows: number[], dateCol: number): CostTableLine[] {
  const headerRow = headerRows.find((r) => /^type of fish feed$/i.test(cell(grid, r, dateCol).trim()));
  if (headerRow === undefined) return [];

  const lines: CostTableLine[] = [];
  for (let r = headerRow + 1; r < Math.min(grid.length, headerRow + 12); r++) {
    const value = cell(grid, r, dateCol).trim();
    if (value === "" || /total/i.test(value)) break;
    const feedCode = normalizeFeedCode(value);
    if (!feedCode) break;
    lines.push({
      feedCode,
      bags: parseSheetNumber(cell(grid, r, dateCol + 1)),
      weightKg: parseSheetNumber(cell(grid, r, dateCol + 2)),
      pricePerKg: parseSheetNumber(cell(grid, r, dateCol + 3)),
    });
  }
  return lines;
}

function readSummaryRows(grid: string[][]): MonthlySummaryRow[] {
  const header = findRow(
    grid,
    (row) => row[0]?.trim().toLowerCase() === "month" && /average weight/i.test(row[2] ?? ""),
  );
  if (header === -1) return [];

  const rows: MonthlySummaryRow[] = [];
  for (let r = header + 1; r < grid.length; r++) {
    const month = cell(grid, r, 0).trim();
    if (!/^\d+$/.test(month)) break;
    rows.push({
      cultureMonth: Number(month),
      deadCount: parseSheetNumber(cell(grid, r, 1)),
      avgWeightKg: parseSheetNumber(cell(grid, r, 2)),
      deadKg: parseSheetNumber(cell(grid, r, 3)),
      feedCostRm: parseSheetNumber(cell(grid, r, 4)),
    });
  }
  return rows;
}

function readReportedTotals(grid: string[][]): ReportedTotals | null {
  const header = findRow(grid, (row) => /total feed consumed amount/i.test(row[0] ?? ""));
  if (header === -1) return null;
  return {
    totalFeedKg: parseSheetNumber(cell(grid, header + 1, 0)),
    fcr: parseSheetNumber(cell(grid, header + 1, 1)),
    estimatedFishWeightKg: parseSheetNumber(cell(grid, header + 1, 2)),
    deadFishWeightKg: parseSheetNumber(cell(grid, header + 1, 3)),
    harvestWeightKg: parseSheetNumber(cell(grid, header + 1, 4)),
  };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatNumberPlain(value: number) {
  return value.toLocaleString("en-MY", { maximumFractionDigits: 2 });
}
