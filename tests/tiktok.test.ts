import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTikTokProfile,
  syncTikTok,
  tiktokUsername,
} from "../server/tiktok.ts";
test("TikTok usernames accept profiles and reject foreign or video URLs", () => {
  assert.equal(
    tiktokUsername("https://www.tiktok.com/@Dolubatarya/"),
    "dolubatarya",
  );
  assert.equal(tiktokUsername("@gzt.alfa"), "gzt.alfa");
  for (const input of [
    "https://evil.com/@test",
    "https://tiktok.com/@test/video/123",
    "https://user@tiktok.com/@test",
    "bad/name",
    "test.",
    "",
  ])
    assert.throws(() => tiktokUsername(input));
});
const item = {
  id: "7550000000000000001",
  author: { uniqueId: "Dolubatarya" },
  desc: "New EV\nDetails",
  createTime: 1793000000,
  video: { cover: "https://example.com/cover.jpg" },
};
const page = (value: unknown) =>
  `<script type="application/json">${JSON.stringify(value)}</script>`;
test("TikTok parses nested public data, deduplicates and excludes other creators and ads", () => {
  const result = parseTikTokProfile(
    page({
      ItemModule: {
        a: item,
        b: item,
        c: {
          ...item,
          id: "7550000000000000002",
          author: { uniqueId: "other" },
        },
        d: { ...item, id: "7550000000000000003", isAd: true },
      },
    }),
    "@dolubatarya",
    "creator",
  );
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].platform, "tiktok");
  assert.equal(result.posts[0].videoId, item.id);
  assert.equal(
    result.posts[0].published,
    new Date(item.createTime * 1000).toISOString(),
  );
  assert.equal(
    result.posts[0].url,
    `https://www.tiktok.com/@dolubatarya/video/${item.id}`,
  );
  assert.throws(
    () => parseTikTokProfile("<html>Please wait...</html>", "dolubatarya", "c"),
    /did not expose/,
  );
});
test("TikTok sync uses normalized profile and reports HTTP failures", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://www.tiktok.com/@dolubatarya");
    return new Response(page({ items: [item] }));
  };
  try {
    assert.equal((await syncTikTok("@Dolubatarya", "c")).posts.length, 1);
    globalThis.fetch = async () => new Response("Blocked", { status: 403 });
    await assert.rejects(syncTikTok("dolubatarya", "c"), /HTTP 403/);
  } finally {
    globalThis.fetch = original;
  }
});
