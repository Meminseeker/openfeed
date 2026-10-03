import { test } from "node:test";
import assert from "node:assert/strict";
import { syncChannel } from "../server/youtube.ts";
const channelId = "UCLRYyGAoqR26MpjAmbrG6oQ";
test("sync fetches only selected tabs and restricted upload types cannot leak through RSS", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/feeds/"))
      return new Response(
        "<feed><entry><yt:videoId>long</yt:videoId><title>Long video</title><published>2026-09-30T00:00:00Z</published></entry><entry><yt:videoId>short</yt:videoId><title>Short</title><published>2026-09-29T00:00:00Z</published></entry></feed>",
      );
    const data = url.endsWith("/videos")
      ? {
          videoRenderer: {
            videoId: "long",
            title: { simpleText: "Long video" },
          },
        }
      : url.endsWith("/shorts")
        ? {
            reelItemRenderer: {
              videoId: "short",
              headline: { simpleText: "Short" },
            },
          }
        : {
            backstagePostRenderer: {
              postId: "post",
              authorEndpoint: { browseEndpoint: { browseId: channelId } },
            },
          };
    return new Response(`var ytInitialData = ${JSON.stringify(data)};`);
  };
  try {
    let result = await syncChannel(channelId, "creator", ["video"]);
    assert.deepEqual(
      result.posts.map((p) => p.id),
      ["long"],
    );
    assert.equal(result.posts[0].published, "2026-09-30T00:00:00Z");
    assert.ok(
      !requests.some((r) => r.endsWith("/shorts") || r.endsWith("/posts")),
    );
    requests.length = 0;
    result = await syncChannel(channelId, "creator", ["short"]);
    assert.deepEqual(
      result.posts.map((p) => [p.id, p.kind]),
      [["short", "short"]],
    );
    assert.ok(!requests.some((r) => r.endsWith("/videos")));
    requests.length = 0;
    result = await syncChannel(channelId, "creator", ["community"]);
    assert.deepEqual(
      result.posts.map((p) => p.kind),
      ["community"],
    );
    assert.equal(requests.length, 1);
    assert.ok(requests[0].endsWith("/posts"));
    requests.length = 0;
    result = await syncChannel(channelId, "creator", []);
    assert.equal(result.posts.length, 0);
    assert.equal(requests.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("RSS failure does not prevent the selected public tab from syncing", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).includes("/feeds/")
      ? new Response("", { status: 503 })
      : new Response(
          'var ytInitialData = {"videoRenderer":{"videoId":"long","title":{"simpleText":"Long"}}};',
        );
  try {
    const result = await syncChannel(channelId, "creator", ["video"]);
    assert.equal(result.posts.length, 1);
    assert.match(result.warning, /Upload feed unavailable/);
  } finally {
    globalThis.fetch = original;
  }
});
