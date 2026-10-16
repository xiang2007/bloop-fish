import { dayKeyToDate, daysBetween, formatDay, formatMonth } from "../dates";
import { formatNumber } from "../format";
import { LOCALE_TAGS, type Locale } from "./config";
import type { MessageKey, Messages } from "./messages/en";

export type TranslateParams = Record<string, string | number>;
export type T = (key: MessageKey, params?: TranslateParams) => string;

// "{name}" placeholders are filled from params; numbers are formatted.
// When params.n is 1 and a "<key>_one" message exists, that one is used,
// so English can say "1 day" / "2 days" while Chinese keeps one form.
export function makeT(messages: Messages): T {
  return (key, params) => {
    const oneKey = `${key}_one` as MessageKey;
    const template = params?.n === 1 && messages[oneKey] !== undefined ? messages[oneKey] : messages[key];
    if (template === undefined) return key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];
      if (value === undefined) return match;
      // Two decimals so an FCR like 1.35 survives; counts are whole anyway.
      return typeof value === "number" ? formatNumber(value, 2) : value;
    });
  };
}

// Locale-aware versions of the date helpers, so callers don't thread the
// locale through every format call.
export function makeFormatters(locale: Locale, t: T) {
  const tag = LOCALE_TAGS[locale];
  return {
    day: (date: Date, options?: { weekday?: boolean; year?: boolean }) => formatDay(date, { ...options, tag }),
    dayKey: (key: string, options?: { weekday?: boolean; year?: boolean }) =>
      formatDay(dayKeyToDate(key), { ...options, tag }),
    month: (monthKey: string, style: "short" | "long" = "short") => formatMonth(monthKey, style, tag),
    monthName: (monthKey: string) =>
      dayKeyToDate(`${monthKey}-01`).toLocaleDateString(tag, { timeZone: "UTC", month: "short" }),
    relativeDays: (fromKey: string, toKey: string) => {
      const days = daysBetween(fromKey, toKey);
      if (days === 0) return t("time.today");
      if (days === 1) return t("time.yesterday");
      if (days < 0) return t("time.inDays", { n: -days });
      return t("time.daysAgo", { n: days });
    },
    bags: (value: number) => t("unit.bags", { n: Number(value.toFixed(1)) }),
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;
export type I18n = { locale: Locale; t: T; fmt: Formatters };

export function makeI18n(locale: Locale, messages: Messages): I18n {
  const t = makeT(messages);
  return { locale, t, fmt: makeFormatters(locale, t) };
}
