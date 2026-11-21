// Pure translation helpers. React wiring lives in LocaleProvider.tsx.
import { en } from "./locales/en";
import { tr } from "./locales/tr";
import { noticesTr } from "./locales/notices-tr/index";
import {
  noticeMessages,
  noticesText,
  type Notice,
  type NoticeCode,
} from "./notices/index";
import type { Account, Creator, Playlist } from "./types";

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

// Server notices: English templates come from src/notices, other languages
// from src/locales/notices-<locale>.
const noticeDictionaries: Record<Locale, Record<NoticeCode, string>> = {
  en: noticeMessages,
  tr: noticesTr,
};
export function translateNotices(locale: Locale, notices: readonly Notice[]) {
  return noticesText(notices, noticeDictionaries[locale]);
}

// The text of a thrown error: translated notices when the server sent them,
// otherwise its (English) message, otherwise a generic failure.
export function errorText(locale: Locale, error: unknown) {
  const notices = (error as { notices?: Notice[] } | null)?.notices;
  if (Array.isArray(notices) && notices.length)
    return translateNotices(locale, notices);
  const message = error instanceof Error ? error.message : "";
  return !message || message === "Request failed"
    ? translateNotices(locale, [{ code: "common.requestFailed" }])
    : message;
}

// Stored sync problems. Rows written before notices existed fall back to the
// English text.
export function accountProblem(locale: Locale, account: Account) {
  return account.errorNotices?.length
    ? translateNotices(locale, account.errorNotices)
    : account.error;
}
export const platformNames: Record<string, string> = {
  youtube: "YouTube",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  patreon: "Patreon",
  linkedin: "LinkedIn",
};
// Mirrors creatorError() in server/index.ts.
export function creatorProblem(locale: Locale, creator: Creator) {
  return (
    creator.accounts
      .filter((a) => a.error)
      .map(
        (a) =>
          `${platformNames[a.platform] || a.platform}: ${accountProblem(locale, a)}`,
      )
      .join(" · ") || creator.error
  );
}
export function playlistWarning(locale: Locale, playlist: Playlist) {
  return playlist.warningNotices?.length
    ? translateNotices(locale, playlist.warningNotices)
    : playlist.warning;
}

export type Translate = (key: MessageKey, params?: Params) => string;
export const translator =
  (locale: Locale): Translate =>
  (key, params) =>
    translate(locale, key, params);
