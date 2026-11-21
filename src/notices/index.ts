// User-facing server messages as codes plus parameters, so the client can
// show them in the viewer's language. The server still sends and stores the
// English text; this module is shared by both (the Dockerfile copies
// src/notices into the runtime image), so it must stay erasable-syntax,
// DOM-free and use explicit .ts imports.
import { commonNotices } from "./common.ts";
import { authNotices } from "./auth.ts";
import { coreNotices } from "./core.ts";
import { youtubeNotices } from "./youtube.ts";
import { xNotices } from "./x.ts";
import { instagramNotices } from "./instagram.ts";
import { tiktokNotices } from "./tiktok.ts";
import { patreonNotices } from "./patreon.ts";
import { linkedinNotices } from "./linkedin.ts";
import { libraryNotices } from "./library.ts";

export const noticeDomains = {
  common: commonNotices,
  auth: authNotices,
  core: coreNotices,
  youtube: youtubeNotices,
  x: xNotices,
  instagram: instagramNotices,
  tiktok: tiktokNotices,
  patreon: patreonNotices,
  linkedin: linkedinNotices,
  library: libraryNotices,
};
export const noticeMessages: Record<NoticeCode, string> = Object.assign(
  {},
  ...Object.values(noticeDomains),
);
export type NoticeCode =
  | keyof typeof commonNotices
  | keyof typeof authNotices
  | keyof typeof coreNotices
  | keyof typeof youtubeNotices
  | keyof typeof xNotices
  | keyof typeof instagramNotices
  | keyof typeof tiktokNotices
  | keyof typeof patreonNotices
  | keyof typeof linkedinNotices
  | keyof typeof libraryNotices;
export type NoticeParams = Record<string, string | number>;
export interface Notice {
  code: NoticeCode;
  params?: NoticeParams;
}

export function notice(code: NoticeCode, params?: NoticeParams): Notice {
  return params ? { code, params } : { code };
}

// Fills {name} placeholders; unknown names are left as written.
export function fillTemplate(template: string, params: NoticeParams = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

// Notices in one message are joined with a space, like sentences.
export function noticesText(
  notices: readonly Notice[],
  templates: Partial<Record<NoticeCode, string>> = noticeMessages,
) {
  return notices
    .map((n) =>
      fillTemplate(
        templates[n.code] ?? noticeMessages[n.code] ?? n.code,
        n.params,
      ),
    )
    .join(" ");
}

// An error whose message the client can translate. `message` is the English
// text, so existing callers that read e.message keep working.
export class UserError extends Error {
  notices: Notice[];
  constructor(notices: Notice | Notice[]) {
    const list = Array.isArray(notices) ? notices : [notices];
    super(noticesText(list));
    this.name = "UserError";
    this.notices = list;
  }
}
export const userError = (code: NoticeCode, params?: NoticeParams) =>
  new UserError(notice(code, params));

// Recognizes errors that carry or imply notices: UserError (or any Error with
// a notices array), fetch timeouts, network failures and invalid URLs.
// Anything else has only its English message.
export function errorNotices(e: unknown): Notice[] | undefined {
  if (e instanceof UserError) return e.notices;
  if (e instanceof Error) {
    const carried = (e as { notices?: unknown }).notices;
    if (Array.isArray(carried) && carried.length) return carried as Notice[];
    if (e.name === "TimeoutError" || e.name === "AbortError")
      return [notice("common.timeout")];
    if (e instanceof TypeError && e.message === "fetch failed")
      return [notice("common.network")];
    // new URL() on user input (e.g. "https://" in a profile field).
    if (
      e instanceof TypeError &&
      (e as { code?: string }).code === "ERR_INVALID_URL" &&
      e.message === "Invalid URL"
    )
      return [notice("common.invalidUrl")];
  }
  return undefined;
}

// Normalizes a warning or error into the stored/sent pair. A string stays
// English-only; a Notice list or UserError also carries its notices.
export function describeProblem(problem: unknown): {
  text?: string;
  notices?: Notice[];
} {
  if (!problem) return {};
  if (typeof problem === "string") return { text: problem };
  if (Array.isArray(problem))
    return problem.length
      ? { text: noticesText(problem), notices: problem }
      : {};
  if (problem instanceof Error)
    return { text: problem.message, notices: errorNotices(problem) };
  return { text: String(problem) };
}

// JSON body for an error response: English `error` plus `notices`.
export function errorBody(problem: unknown) {
  const { text, notices } = describeProblem(problem);
  return {
    error: text || noticeMessages["common.requestFailed"],
    ...(notices ? { notices } : {}),
  };
}
export const noticeBody = (code: NoticeCode, params?: NoticeParams) =>
  errorBody([notice(code, params)]);
