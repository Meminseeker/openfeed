import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectLocale,
  initialLocale,
  locales,
  localeNames,
  translate,
  type Locale,
  type Message,
} from "../src/i18n.ts";
import { en } from "../src/locales/en.ts";
import { tr } from "../src/locales/tr.ts";
import { relativeTime } from "../src/relative-time.ts";
import { postLabel } from "../src/post-label.ts";
import type { Creator, Post } from "../src/types.ts";
import { accountProblem, creatorProblem, errorText } from "../src/i18n.ts";
import {
  noticeDomains,
  noticeMessages,
  UserError,
  errorNotices,
  notice,
} from "../src/notices/index.ts";
import { noticesTr } from "../src/locales/notices-tr/index.ts";
import { ApiError } from "../src/api.ts";

test("the first supported browser language wins, otherwise English", () => {
  assert.equal(detectLocale(["tr-TR", "en-US"]), "tr");
  assert.equal(detectLocale(["TR"]), "tr");
  assert.equal(detectLocale(["de-DE", "tr", "en"]), "tr");
  assert.equal(detectLocale(["en-GB", "tr"]), "en");
  assert.equal(detectLocale(["de-DE", "fr"]), "en");
  assert.equal(detectLocale([]), "en");
});

test("a saved language choice overrides the browser languages", () => {
  assert.equal(initialLocale("en", ["tr-TR"]), "en");
  assert.equal(initialLocale("tr", ["en-US"]), "tr");
  assert.equal(initialLocale("xx", ["tr-TR"]), "tr");
  assert.equal(initialLocale(null, ["fr"]), "en");
});

test("translations fill placeholders and pick plural forms", () => {
  assert.equal(
    translate("en", "creators.accounts", { count: 1 }),
    "1 connected account",
  );
  assert.equal(
    translate("en", "creators.accounts", { count: 3 }),
    "3 connected accounts",
  );
  assert.equal(
    translate("tr", "creators.accounts", { count: 3 }),
    "3 bağlı hesap",
  );
  assert.equal(
    translate("tr", "page.feed.topicTitle", { topic: "Tasarım" }),
    "Tasarım, sizin kurallarınızla.",
  );
  assert.equal(translate("en", "feed.remaining"), "{count} remaining");
});

const placeholders = (message: Message) =>
  (typeof message === "string" ? [message] : [message.one, message.other])
    .flatMap((text) => text.match(/\{\w+\}/g) || [])
    .sort()
    .filter((p, i, all) => all.indexOf(p) === i);

test("every locale has every English key with the same placeholders", () => {
  const dictionaries: Record<Locale, Record<string, Message>> = { en, tr };
  assert.deepEqual(Object.keys(localeNames).sort(), [...locales].sort());
  for (const locale of locales) {
    const messages = dictionaries[locale];
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort());
    for (const [key, message] of Object.entries(en)) {
      assert.deepEqual(
        placeholders(messages[key]),
        placeholders(message),
        `${locale}:${key}`,
      );
      assert.ok(
        typeof messages[key] === "string"
          ? messages[key]
          : messages[key].one && messages[key].other,
        `${locale}:${key} is empty`,
      );
    }
  }
});

test("relative times and post labels follow the chosen language", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
  assert.equal(relativeTime(ago(5), now, "tr"), "az önce");
  assert.equal(relativeTime(ago(300), now, "tr"), "5 dk önce");
  assert.equal(relativeTime(ago(259200), now, "tr"), "3 gün önce");
  assert.equal(relativeTime("", now, "tr"), "Tarih bilinmiyor");
  assert.equal(relativeTime(ago(7200), now, "en"), "2h ago");
  assert.equal(
    postLabel({ platform: "instagram", kind: "video" } as Post, "tr"),
    "Instagram Videosu",
  );
  assert.equal(
    postLabel({ platform: "x", kind: "post", repost: true } as Post),
    "X Repost",
  );
});

test("server notice codes are namespaced, unique and translated with the same placeholders", () => {
  const seen = new Set<string>();
  for (const [domain, templates] of Object.entries(noticeDomains))
    for (const code of Object.keys(templates)) {
      assert.ok(code.startsWith(`${domain}.`), code);
      assert.ok(!seen.has(code), `duplicate ${code}`);
      seen.add(code);
    }
  assert.deepEqual(Object.keys(noticesTr).sort(), [...seen].sort());
  for (const [code, english] of Object.entries(noticeMessages)) {
    const turkish = noticesTr[code as keyof typeof noticesTr];
    assert.ok(turkish.trim(), `tr:${code} is empty`);
    assert.deepEqual(placeholders(turkish), placeholders(english), code);
  }
});

test("errors and stored problems show translated notices, else their English text", () => {
  const missing = new ApiError("There is no account…", 401, [
    notice("auth.noAccount", { username: "ada" }),
  ]);
  assert.match(
    errorText("tr", missing),
    /“ada” kullanıcı adıyla bir hesap yok/,
  );
  assert.match(errorText("en", missing), /no account with the username “ada”/);
  assert.equal(
    errorText("tr", new Error("Upstream said no")),
    "Upstream said no",
  );
  assert.equal(
    errorText("tr", new ApiError("Request failed", 404)),
    "İstek başarısız oldu",
  );
  assert.deepEqual(errorNotices(new UserError(notice("auth.loginRequired"))), [
    { code: "auth.loginRequired" },
  ]);
  const timeout = new Error("aborted");
  timeout.name = "TimeoutError";
  assert.deepEqual(errorNotices(timeout), [{ code: "common.timeout" }]);

  const creator = {
    error:
      "X: legacy text · TikTok: Could not reach the source. Try again later.",
    accounts: [
      { platform: "x", username: "a", error: "legacy text" },
      {
        platform: "tiktok",
        username: "b",
        error: "Could not reach the source. Try again later.",
        errorNotices: [notice("common.network")],
      },
      { platform: "youtube", username: "c" },
    ],
  } as Creator;
  assert.equal(
    accountProblem("tr", creator.accounts[1]),
    "Kaynağa ulaşılamadı. Daha sonra tekrar deneyin.",
  );
  assert.equal(
    creatorProblem("tr", creator),
    "X: legacy text · TikTok: Kaynağa ulaşılamadı. Daha sonra tekrar deneyin.",
  );
  assert.equal(creatorProblem("en", creator), creator.error);
});
