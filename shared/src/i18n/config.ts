export const LOCALES = ["en", "zh", "ms"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "fisheye_lang";

// Shown in the language switcher in each language's own name.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  ms: "Bahasa Melayu",
};

// BCP 47 tags for <html lang> and Intl date formatting.
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-GB",
  zh: "zh-CN",
  ms: "ms-MY",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
