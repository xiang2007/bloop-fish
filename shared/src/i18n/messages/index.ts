import type { Locale } from "../config";
import { en, type Messages } from "./en";
import { ms } from "./ms";
import { zh } from "./zh";

const MESSAGES: Record<Locale, Messages> = { en, zh, ms };

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
