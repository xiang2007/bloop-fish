"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@fisheye/shared/i18n/config";
import type { Messages } from "@fisheye/shared/i18n/messages/en";
import { makeI18n, type I18n } from "@fisheye/shared/i18n/translate";

const I18nContext = createContext<I18n | null>(null);

// Only the active language's messages are sent to the browser.
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => makeI18n(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
