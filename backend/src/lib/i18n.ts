import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@fisheye/shared/i18n/config";
import { makeI18n } from "@fisheye/shared/i18n/translate";
import { messagesFor } from "@fisheye/shared/i18n/messages";
import { requestCookie } from "./context";

export function getLocale(): Locale {
  const value = requestCookie(LOCALE_COOKIE);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// Translator for the current request. Used for validation messages.
export async function getI18n() {
  const locale = getLocale();
  return makeI18n(locale, messagesFor(locale));
}
