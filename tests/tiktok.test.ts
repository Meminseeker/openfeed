import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseTikTokProfile,
  parseTikTokEmbed,
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
    if (String(url).includes("/embed/"))
      return new Response("overload-protect triggered");
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

const embedFixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/tiktok-creator.json", import.meta.url),
    "utf8",
  ),
);
const embedEntry = () =>
  structuredClone(embedFixture).source.data["/embed/@baby._.vibz"];
const embedPage = (entry: unknown) =>
  page({ source: { data: { "/embed/@baby._.vibz": entry } } });
test("real creator embed imports baby._.vibz's latest video without a video object or createTime", () => {
  const result = parseTikTokEmbed(
    page(embedFixture),
    "@baby._.vibz",
    "baby-creator",
  );
  assert.equal(result.posts.length, 10);
  const latest = result.posts[0];
  assert.equal(latest.id, "tiktok:7701241895976013088");
  assert.equal(latest.creatorId, "baby-creator");
  assert.equal(latest.published, "2026-10-27T07:11:47.000Z");
  assert.equal(latest.publishedApproximate, true);
  assert.equal(latest.videoId, "7701241895976013088");
  assert.match(latest.title, /Baby kid/);
});
test("creator embeds reject mismatched/private/error payloads and filter private videos", () => {
  for (const change of [
    { userInfo: { uniqueId: "someone-else" } },
    { userInfo: { uniqueId: "baby._.vibz", privateAccount: true } },
    { isError: true },
    { isReady: false },
    { videoList: null },
  ])
    assert.throws(() =>
      parseTikTokEmbed(
        embedPage({ ...embedEntry(), ...change }),
        "baby._.vibz",
        "c",
      ),
    );
  const entry = embedEntry();
  entry.videoList[0].privateItem = true;
  entry.videoList[1].authorUniqueId = "other";
  entry.videoList[2].id = "invalid";
  entry.videoList.push(entry.videoList[3]);
  assert.equal(
    parseTikTokEmbed(embedPage(entry), "baby._.vibz", "c").posts.length,
    7,
  );
  assert.equal(
    parseTikTokEmbed(embedPage({ ...entry, videoList: [] }), "baby._.vibz", "c")
      .posts.length,
    0,
  );
});
test("sync uses the creator embed first and never treats challenges as an empty success", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(page(embedFixture));
  };
  try {
    assert.equal((await syncTikTok("baby._.vibz", "c")).posts.length, 10);
    assert.deepEqual(requests, ["https://www.tiktok.com/embed/@baby._.vibz"]);
    requests.length = 0;
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      return new Response(
        embedPage({
          ...embedEntry(),
          userInfo: { uniqueId: "baby._.vibz", privateAccount: true },
        }),
      );
    };
    await assert.rejects(syncTikTok("baby._.vibz", "c"), /Private TikTok/);
    assert.equal(requests.length, 1);
    globalThis.fetch = async () =>
      new Response('<script id="slardar-config">SlardarWAF</script>');
    await assert.rejects(syncTikTok("baby._.vibz", "c"), /blocked the request/);
  } finally {
    globalThis.fetch = original;
  }
});

test("creator embeds expose native playback only for TikTok HTTPS media hosts", () => {
  const entry = embedEntry();
  entry.videoList[0].playAddr = "https://v16.tiktokcdn.com/video.mp4";
  entry.videoList[1].playAddr = "https://evil.example/video.mp4";
  entry.videoList[2].playAddr = "http://v16.tiktokcdn.com/video.mp4";
  const { posts } = parseTikTokEmbed(embedPage(entry), "baby._.vibz", "c");
  assert.equal(posts[0].videos?.[0].url, "https://v16.tiktokcdn.com/video.mp4");
  assert.equal(posts[1].videos, undefined);
  assert.equal(posts[2].videos, undefined);
});
