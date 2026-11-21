// Pure translation helpers. React wiring lives in I18n.tsx.
import { en } from "./locales/en";
import { tr } from "./locales/tr";

// A message is plain text with {name} placeholders, or a plural pair chosen
// by the `count` parameter through Intl.PluralRules.
export type Message = string | { one: string; other: string };
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, Message>;
export type Params = Record<string, string | number>;

const dictionaries = { en, tr } satisfies Record<string, Messages>;
export type Locale = keyof typeof dictionaries;
export const locales = Object.keys(dictionaries) as Locale[];
// Each language is named in itself so people can find their own.
export const localeNames: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
};
export const defaultLocale: Locale = "en";
export const localeStorageKey = "openfeed.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in dictionaries;
}

// Picks the first browser language whose primary subtag is supported
// ("tr-TR" → "tr"), otherwise English.
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const primary = language.trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return defaultLocale;
}

// A saved choice wins over the browser languages.
export function initialLocale(
  stored: string | null | undefined,
  languages: readonly string[],
): Locale {
  return isLocale(stored) ? stored : detectLocale(languages);
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params: Params = {},
): string {
  const message: Message =
    dictionaries[locale][key] ?? dictionaries[defaultLocale][key];
  const text =
    typeof message === "string"
      ? message
      : new Intl.PluralRules(locale).select(Number(params.count)) === "one"
        ? message.one
        : message.other;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type Translate = (key: MessageKey, params?: Params) => string;
export const translator =
  (locale: Locale): Translate =>
  (key, params) =>
    translate(locale, key, params);
