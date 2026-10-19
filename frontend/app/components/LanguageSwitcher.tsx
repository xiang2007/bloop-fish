"use client";

import { setLocale } from "@/lib/actions";
import { LOCALES, LOCALE_NAMES } from "@fisheye/shared/i18n/config";
import { useI18n } from "./I18nProvider";
import { GlobeIcon } from "./icons";
import { cx } from "./ui";

// Changes the language for this browser; the choice is kept in a cookie.
export default function LanguageSwitcher({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { locale, t } = useI18n();
  return (
    <form action={setLocale} className={cx("relative inline-flex items-center", className)}>
      <GlobeIcon
        className={cx("pointer-events-none absolute left-2.5 size-4", tone === "dark" ? "text-sidebar-muted" : "text-ink-3")}
      />
      <select
        // Remount on change so the shown value follows the saved language.
        key={locale}
        name="locale"
        defaultValue={locale}
        aria-label={t("nav.language")}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={cx(
          "h-8 cursor-pointer appearance-none rounded-md pr-3 pl-8 text-sm font-medium focus:outline-none focus:ring-2",
          tone === "dark"
            ? "bg-white/5 text-sidebar-ink hover:bg-white/10 focus:ring-white/20 [&>option]:text-ink"
            : "border border-line bg-surface text-ink-2 hover:border-line-strong focus:ring-brand/15",
        )}
      >
        {LOCALES.map((value) => (
          <option key={value} value={value}>
            {LOCALE_NAMES[value]}
          </option>
        ))}
      </select>
    </form>
  );
}
