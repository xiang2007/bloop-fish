import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@fisheye/shared/i18n/config";
import { makeI18n } from "@fisheye/shared/i18n/translate";
import { messagesFor } from "@fisheye/shared/i18n/messages";

// Only the root layout uses this: it picks the page language from the cookie
// before anything is fetched, so the first paint is already in the right language.
export async function getI18n() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  return makeI18n(locale, messagesFor(locale));
}
