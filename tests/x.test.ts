import { test } from "node:test";
import assert from "node:assert/strict";
import { parseXTimeline, xUsername, syncX } from "../server/x.ts";
const tweet = (id: string, extra: any = {}) => ({
  id_str: id,
  created_at: "Mon Sep 08 09:00:17 +0000 2025",
  full_text: "Hello &amp; world https://t.co/media",
  user: { screen_name: "Test", protected: false },
  ...extra,
});
const html = (tweets: any[]) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { timeline: { entries: tweets.map((tweet) => ({ type: "tweet", content: { tweet } })) } } } })}</script>`;
test("X usernames accept profile URLs and reject foreign URLs and non-profile paths", () => {
  assert.equal(xUsername("https://twitter.com/Test/"), "Test");
  assert.equal(xUsername(" @test "), "test");
  for (const value of [
    "https://evil.test/Test",
    "https://x.com/Test/status/123",
    "../test",
    "https://x.com@evil.test/Test",
    "https://x.com/search",
    "",
    "https://x.com:444/test",
  ])
    assert.throws(() => xUsername(value));
});
test("X parses all own photos, MP4 videos and GIFs, excludes reposts, other authors and malformed dates", () => {
  const result = parseXTimeline(
    html([
      tweet("123", {
        extended_entities: {
          media: [
            {
              type: "photo",
              media_url_https: "https://pbs.twimg.com/one.jpg",
              url: "https://t.co/media",
            },
            { type: "photo", media_url_https: "https://pbs.twimg.com/two.jpg" },
            {
              type: "video",
              media_url_https: "https://pbs.twimg.com/poster.jpg",
              video_info: {
                variants: [
                  {
                    content_type: "video/mp4",
                    bitrate: 1,
                    url: "https://video.twimg.com/low.mp4",
                  },
                  {
                    content_type: "video/mp4",
                    bitrate: 2,
                    url: "https://video.twimg.com/high.mp4",
                  },
                  {
                    content_type: "video/mp4",
                    bitrate: 999,
                    url: "https://evil.test/a.mp4",
                  },
                ],
              },
            },
            {
              type: "animated_gif",
              video_info: {
                variants: [
                  {
                    content_type: "video/mp4",
                    url: "https://video.twimg.com/gif.mp4",
                  },
                ],
              },
            },
          ],
        },
      }),
      tweet("124", { user: { screen_name: "Other" } }),
      tweet("125", { retweeted_status: {} }),
      tweet("126", { full_text: "RT @Other: hi" }),
      tweet("127", { created_at: "invalid" }),
    ]),
    "test",
    "creator",
  );
  assert.equal(result.posts.length, 1);
  const p = result.posts[0];
  assert.equal(p.id, "x:123");
  assert.equal(p.platform, "x");
  assert.equal(p.kind, "post");
  assert.equal(p.text, "Hello & world");
  assert.equal(p.url, "https://x.com/test/status/123");
  assert.deepEqual(p.images, [
    "https://pbs.twimg.com/one.jpg",
    "https://pbs.twimg.com/two.jpg",
  ]);
  assert.equal(p.videos?.[0].url, "https://video.twimg.com/high.mp4");
  assert.equal(p.videos?.[1].loop, true);
});
test("X rejects protected accounts and unavailable timelines rather than reporting a successful empty refresh", () => {
  assert.throws(
    () =>
      parseXTimeline(
        html([
          tweet("123", { user: { screen_name: "test", protected: true } }),
        ]),
        "test",
        "c",
      ),
    /Private/,
  );
  assert.throws(
    () => parseXTimeline("Unavailable", "test", "c"),
    /unavailable/,
  );
  assert.throws(
    () =>
      parseXTimeline(
        '<script id="__NEXT_DATA__">{"props":{"pageProps":{}}}</script>',
        "test",
        "c",
      ),
    /Private accounts/,
  );
  assert.deepEqual(parseXTimeline(html([]), "test", "c").posts, []);
});
test("X sync requests only the public endpoint without credentials and reports rate limits", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/test",
    );
    assert.equal(init?.credentials, undefined);
    return new Response("", { status: 429 });
  };
  try {
    await assert.rejects(syncX("@test", "c"), /429/);
  } finally {
    globalThis.fetch = original;
  }
});
test("official X mode checks privacy, expands media and never falls back after errors", async () => {
  const original = globalThis.fetch,
    oldToken = process.env.X_BEARER_TOKEN;
  process.env.X_BEARER_TOKEN = "test-only-token";
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-only-token",
    );
    if (url.includes("by/username"))
      return Response.json({
        data: { id: "456", name: "Test", protected: false },
      });
    assert.ok(url.includes("note_post"));
    return Response.json({
      data: [
        {
          id: "123",
          author_id: "456",
          note_post: { text: "Long post" },
          created_at: "2026-10-04T00:00:00Z",
          attachments: { media_keys: ["m"] },
        },
        {
          id: "124",
          author_id: "other",
          text: "No",
          created_at: "2026-10-04T00:00:00Z",
        },
      ],
      includes: {
        media: [
          {
            media_key: "m",
            type: "photo",
            url: "https://pbs.twimg.com/photo.jpg",
          },
        ],
      },
    });
  };
  try {
    const result = await syncX("test", "c");
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0].text, "Long post");
    assert.equal(result.posts[0].image, "https://pbs.twimg.com/photo.jpg");
    globalThis.fetch = async () =>
      Response.json({ data: { id: "456", protected: true } });
    await assert.rejects(syncX("test", "c"), /Private/);
    globalThis.fetch = async () => new Response("", { status: 401 });
    await assert.rejects(syncX("test", "c"), /401/);
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = original;
    if (oldToken === undefined) delete process.env.X_BEARER_TOKEN;
    else process.env.X_BEARER_TOKEN = oldToken;
  }
});
test("official X requests exclude replies, retain reposts and use a newer-only cursor", async () => {
  const original = globalThis.fetch,
    oldToken = process.env.X_BEARER_TOKEN;
  process.env.X_BEARER_TOKEN = "test-only-token";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("by/username"))
      return Response.json({ data: { id: "456", protected: false } });
    assert.equal(url.searchParams.get("exclude"), "replies");
    assert.equal(url.searchParams.get("max_results"), "30");
    assert.equal(url.searchParams.get("since_id"), "9007199254740993");
    return Response.json({
      data: [
        {
          id: "9007199254740995",
          author_id: "456",
          text: "RT @other: Shared post",
          created_at: "2026-10-04T00:00:00Z",
          referenced_tweets: [{ type: "retweeted", id: "111" }],
        },
        {
          id: "9007199254740994",
          author_id: "456",
          text: "Reply",
          created_at: "2026-10-04T00:00:00Z",
          referenced_tweets: [{ type: "replied_to", id: "112" }],
        },
      ],
      meta: { next_token: "more" },
    });
  };
  try {
    const result = await syncX("test", "c", "9007199254740993");
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0].repost, true);
    assert.equal("newestId" in result && result.newestId, "9007199254740995");
    assert.match(result.warning!, /30/);
  } finally {
    globalThis.fetch = original;
    if (oldToken === undefined) delete process.env.X_BEARER_TOKEN;
    else process.env.X_BEARER_TOKEN = oldToken;
  }
});
test("public X snapshots exclude replies and can retain approved-account reposts", () => {
  const result = parseXTimeline(
    html([
      tweet("123", { in_reply_to_status_id_str: "100" }),
      tweet("124", {
        retweeted_status_id_str: "101",
        full_text: "RT @other: shared",
      }),
    ]),
    "test",
    "c",
    true,
  );
  assert.deepEqual(
    result.posts.map((p) => [p.id, p.repost]),
    [["x:124", true]],
  );
});

test("reported long posts recover their complete text from the canonical X page", async () => {
  const { readFileSync } = await import("node:fs");
  const { parseXPostText } = await import("../server/x.ts");
  for (const [id, ending] of [
    ["2115201880208904628", "ölmesi gerekiyor?"],
    ["2115186777749127475", "Marcus Aurelius"],
  ]) {
    const html = readFileSync(
      new URL(`./fixtures/x-long-${id}.html`, import.meta.url),
      "utf8",
    );
    const text = parseXPostText(html, {
      url: `https://x.com/gztcom/status/${id}`,
      text: "Short preview",
    });
    assert.ok(text?.includes(ending));
    assert.ok(text?.includes("\n\n"));
    assert.equal(
      parseXPostText(html, { url: "https://x.com/other/status/123" }),
      undefined,
    );
  }
});
test("explicit posts-only sync excludes reposts in the public snapshot", async () => {
  const original = globalThis.fetch;
  const oldToken = process.env.X_BEARER_TOKEN;
  delete process.env.X_BEARER_TOKEN;
  globalThis.fetch = async () =>
    new Response(
      html([
        tweet("123"),
        tweet("124", {
          retweeted_status_id_str: "99",
          full_text: "RT @other: Shared",
        }),
      ]),
    );
  try {
    const result = await syncX("test", "c", undefined, false);
    assert.deepEqual(
      result.posts.map((p) => p.id),
      ["x:123"],
    );
  } finally {
    globalThis.fetch = original;
    if (oldToken === undefined) delete process.env.X_BEARER_TOKEN;
    else process.env.X_BEARER_TOKEN = oldToken;
  }
});
