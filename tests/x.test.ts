import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseXTimeline,
  xUsername,
  syncX,
  syncXSources,
  xSourceKey,
} from "../server/x.ts";
import { noticesText, UserError } from "../src/notices/index.ts";
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

test("detail repair retries legacy expansions and handles short previews and reposts with verified full-status fallback", async () => {
  const { expandXPost } = await import("../server/x.ts");
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).startsWith("https://x.com/")
      ? new Response("blocked", { status: 403 })
      : Response.json({
          code: 200,
          tweet: {
            id: "999001",
            text: "The full post\n\nWith its complete ending.",
            author: { screen_name: "test" },
          },
        });
  try {
    for (const patch of [
      { text: "Tiny…" },
      { text: "Legacy text", textExpanded: true },
      { text: "RT @other: preview", repost: true },
    ]) {
      const p = await expandXPost({
        id: "x:999001",
        creatorId: "c",
        platform: "x",
        title: "Preview",
        url: "https://x.com/test/status/999001",
        kind: "post",
        published: "",
        read: false,
        saved: false,
        ...patch,
      });
      assert.equal(p.text, "The full post\n\nWith its complete ending.");
      assert.equal(p.textVersion, 2);
      assert.equal(p.textTruncated, false);
    }
  } finally {
    globalThis.fetch = original;
  }
});

const sdTweet = (id: string, user: string, extra: any = {}) => ({
  id_str: id,
  tweet_created_at: "2026-11-20T10:00:00.000000Z",
  full_text: `Post ${id}`,
  user: {
    screen_name: user,
    protected: false,
    profile_image_url_https: "https://pbs.twimg.com/a.jpg",
  },
  ...extra,
});
async function withSocialData(
  respond: (url: URL, init: RequestInit) => any,
  run: (calls: { url: URL; init: RequestInit }[]) => Promise<void>,
  interval = "0",
) {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.SOCIALDATA_API_KEY;
  const oldInterval = process.env.SOCIALDATA_MIN_INTERVAL_MS;
  const calls: { url: URL; init: RequestInit }[] = [];
  process.env.SOCIALDATA_API_KEY = "test-only-key";
  process.env.SOCIALDATA_MIN_INTERVAL_MS = interval;
  globalThis.fetch = (async (input: any, init: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const body = respond(url, init);
    return typeof body === "number"
      ? new Response("{}", { status: body })
      : Response.json(body);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.SOCIALDATA_API_KEY;
    else process.env.SOCIALDATA_API_KEY = oldKey;
    if (oldInterval === undefined)
      delete process.env.SOCIALDATA_MIN_INTERVAL_MS;
    else process.env.SOCIALDATA_MIN_INTERVAL_MS = oldInterval;
  }
}
const now = Date.parse("2026-11-20T12:00:00Z");
const checked = "2026-11-20T11:00:00.000Z";

test("SocialData batches accounts into one OR search bounded by the last refresh and splits posts per account", async () => {
  const long = "x".repeat(2000);
  await withSocialData(
    (url) =>
      url.searchParams.get("cursor")
        ? { tweets: [], next_cursor: null }
        : {
            tweets: [
              sdTweet("300", "Alice", {
                full_text: long,
                extended_entities: {
                  media: [
                    {
                      type: "video",
                      media_url_https: "https://pbs.twimg.com/p.jpg",
                      video_info: {
                        variants: [
                          {
                            content_type: "video/mp4",
                            bitrate: 832000,
                            url: "https://video.twimg.com/low.mp4",
                          },
                          {
                            content_type: "video/mp4",
                            bitrate: 2176000,
                            url: "https://video.twimg.com/high.mp4",
                          },
                        ],
                      },
                    },
                  ],
                },
              }),
              sdTweet("250", "bob"),
              sdTweet("90", "bob"),
              sdTweet("280", "carol"),
            ],
            next_cursor: "next",
          },
    async (calls) => {
      const results = await syncXSources(
        [
          {
            username: "alice",
            sinceId: "100",
            checkedAt: checked,
            includeReposts: false,
          },
          {
            username: "bob",
            sinceId: "100",
            checkedAt: checked,
            includeReposts: false,
          },
        ],
        now,
        7,
      );
      assert.equal(calls.length, 2);
      assert.equal(calls[0].url.origin, "https://api.socialdata.tools");
      assert.equal(
        calls[0].url.searchParams.get("query"),
        `(from:alice OR from:bob) -filter:replies -filter:nativeretweets since_time:${Math.floor((Date.parse(checked) - 600000) / 1000)}`,
      );
      assert.equal(calls[0].url.searchParams.get("type"), "Latest");
      assert.equal(calls[1].url.searchParams.get("cursor"), "next");
      assert.equal(
        (calls[0].init.headers as Record<string, string>).Authorization,
        "Bearer test-only-key",
      );
      const alice = results.get(xSourceKey("alice", false));
      const bob = results.get(xSourceKey("bob", false));
      assert.ok(alice && !(alice instanceof Error));
      assert.ok(bob && !(bob instanceof Error));
      assert.deepEqual(
        alice.posts.map((p) => p.id),
        ["x:300"],
      );
      assert.equal(alice.posts[0].text, long);
      assert.equal(alice.posts[0].textExpanded, true);
      assert.equal(alice.posts[0].published, "2026-11-20T10:00:00.000Z");
      assert.equal(
        alice.posts[0].videos?.[0].url,
        "https://video.twimg.com/high.mp4",
      );
      assert.equal(alice.newestId, "300");
      assert.equal(alice.warning, undefined);
      // Bob's post at or before his cursor is dropped; carol was not requested.
      assert.deepEqual(
        bob.posts.map((p) => p.id),
        ["x:250"],
      );
      assert.equal(results.size, 2);
    },
  );
});

test("SocialData keeps repost and non-repost accounts in separate searches and respects the query length limit", async () => {
  const names = Array.from(
    { length: 40 },
    (_, i) => `user_${String(i).padStart(10, "0")}`,
  );
  await withSocialData(
    () => ({ tweets: [], next_cursor: null }),
    async (calls) => {
      const results = await syncXSources(
        [
          ...names.map((username) => ({
            username,
            sinceId: "1",
            checkedAt: checked,
            includeReposts: false,
          })),
          {
            username: "reposter",
            sinceId: "1",
            checkedAt: checked,
            includeReposts: true,
          },
        ],
        now,
      );
      const queries = calls.map((c) => c.url.searchParams.get("query")!);
      assert.ok(queries.length >= 3);
      assert.ok(queries.every((q) => q.length <= 500));
      const reposts = queries.filter((q) => !q.includes("nativeretweets"));
      assert.deepEqual(reposts, [
        `(from:reposter) -filter:replies since_time:${Math.floor((Date.parse(checked) - 600000) / 1000)}`,
      ]);
      for (const name of names)
        assert.equal(
          queries.filter(
            (q) => q.includes(`from:${name})`) || q.includes(`from:${name} `),
          ).length,
          1,
        );
      assert.equal(results.size, 41);
    },
  );
});

test("SocialData searches never-synced accounts alone and reports missing accounts", async () => {
  await withSocialData(
    (url) =>
      url.pathname === "/twitter/user/ghost"
        ? 404
        : url.pathname === "/twitter/user/quiet"
          ? { screen_name: "quiet", protected: false }
          : { tweets: [], next_cursor: null },
    async (calls) => {
      const results = await syncXSources(
        [
          { username: "ghost", includeReposts: false },
          { username: "quiet", includeReposts: false },
        ],
        now,
        7,
      );
      assert.equal(
        calls[0].url.searchParams.get("query"),
        `from:ghost -filter:replies -filter:nativeretweets since_time:${Math.floor((now - 7 * 86400000) / 1000)}`,
      );
      const ghost = results.get(xSourceKey("ghost", false));
      assert.ok(ghost instanceof Error);
      assert.match(ghost.message, /not found/);
      const quiet = results.get(xSourceKey("quiet", false));
      assert.ok(quiet && !(quiet instanceof Error));
      assert.deepEqual(quiet.posts, []);
    },
  );
});

test("SocialData never searches further back than the retention window and reports an empty balance", async () => {
  await withSocialData(
    () => 402,
    async (calls) => {
      const results = await syncXSources(
        [
          {
            username: "old",
            sinceId: "1",
            checkedAt: "2026-01-01T00:00:00Z",
            includeReposts: false,
          },
        ],
        now,
        7,
      );
      assert.match(
        calls[0].url.searchParams.get("query")!,
        new RegExp(`since_time:${Math.floor((now - 7 * 86400000) / 1000)}$`),
      );
      const result = results.get(xSourceKey("old", false));
      assert.ok(result instanceof Error);
      assert.match(result.message, /balance is empty/);
      assert.ok(result instanceof UserError);
      assert.deepEqual(result.notices, [{ code: "x.socialDataBalance" }]);
    },
  );
});

test("SocialData spaces requests so quiet checks stay within the free empty-response allowance", async () => {
  await withSocialData(
    () => ({ tweets: [], next_cursor: null }),
    async () => {
      const started = Date.now();
      await syncXSources(
        [
          {
            username: "a",
            sinceId: "1",
            checkedAt: checked,
            includeReposts: false,
          },
          {
            username: "b",
            sinceId: "1",
            checkedAt: checked,
            includeReposts: true,
          },
        ],
        now,
      );
      assert.ok(Date.now() - started >= 100);
    },
    "100",
  );
});

test("when SocialData search fails, accounts not refreshed for 6 hours fall back to their own timeline", async () => {
  const stale = "2026-11-20T05:00:00.000Z"; // 7 h before `now`
  await withSocialData(
    (url) => {
      if (url.pathname === "/twitter/search") return 500;
      if (url.pathname === "/twitter/user/alice")
        return { id_str: "42", screen_name: "alice", protected: false };
      if (url.pathname === "/twitter/user/42/tweets")
        return {
          tweets: [
            sdTweet("900", "pinned_old", { is_pinned: true }),
            sdTweet("300", "alice"),
            sdTweet("200", "alice"),
            sdTweet("100", "alice"),
            sdTweet("90", "alice"),
          ],
          next_cursor: "more",
        };
      if (url.pathname === "/twitter/user/77/tweets")
        return { tweets: [sdTweet("500", "bob")], next_cursor: null };
      throw new Error(`unexpected ${url}`);
    },
    async (calls) => {
      const results = await syncXSources(
        [
          {
            username: "alice",
            sinceId: "100",
            checkedAt: stale,
            includeReposts: false,
          },
          {
            username: "bob",
            sinceId: "100",
            checkedAt: stale,
            includeReposts: false,
            userId: "77",
          },
          {
            username: "carol",
            sinceId: "100",
            checkedAt: "2026-11-20T09:30:00.000Z",
            includeReposts: false,
          },
        ],
        now,
      );
      const paths = calls.map((c) => c.url.pathname);
      assert.deepEqual(paths, [
        "/twitter/search",
        "/twitter/user/alice",
        "/twitter/user/42/tweets",
        "/twitter/user/77/tweets",
      ]);
      const alice = results.get(xSourceKey("alice", false));
      assert.ok(alice && !(alice instanceof Error));
      assert.deepEqual(
        alice.posts.map((p) => p.id),
        ["x:300", "x:200"],
      );
      assert.equal(alice.userId, "42");
      assert.equal(alice.newestId, "300");
      assert.match(alice.warning!, /timeline was read instead/);
      assert.equal(alice.warningNotices?.[0].code, "x.socialDataFallbackUsed");
      assert.equal(noticesText(alice.warningNotices!), alice.warning);
      const bob = results.get(xSourceKey("bob", false));
      assert.ok(bob && !(bob instanceof Error));
      assert.deepEqual(
        bob.posts.map((p) => p.id),
        ["x:500"],
      );
      const carol = results.get(xSourceKey("carol", false));
      assert.ok(carol instanceof Error);
      assert.match(
        carol.message,
        /at most every 6 hours; next after 15:30 UTC/,
      );
      assert.ok(carol instanceof UserError);
      assert.deepEqual(carol.notices, [
        { code: "x.socialDataFallbackWait", params: { time: "15:30" } },
      ]);
    },
    "100000",
  );
});

test("SocialData timeline fallback is not used for billing or key errors, and reports missing accounts", async () => {
  await withSocialData(
    () => 402,
    async (calls) => {
      const results = await syncXSources(
        [
          {
            username: "alice",
            sinceId: "1",
            checkedAt: "2026-11-01T00:00:00Z",
            includeReposts: false,
          },
        ],
        now,
      );
      assert.equal(calls.length, 1);
      assert.match(
        (results.get(xSourceKey("alice", false)) as Error).message,
        /balance is empty/,
      );
    },
  );
  await withSocialData(
    (url) => (url.pathname === "/twitter/search" ? 503 : 404),
    async () => {
      const results = await syncXSources(
        [{ username: "ghost", includeReposts: false }],
        now,
      );
      assert.match(
        (results.get(xSourceKey("ghost", false)) as Error).message,
        /not found/,
      );
    },
  );
});

test("X errors and warnings carry translatable notices with the same English text", () => {
  assert.throws(
    () => xUsername("https://example.com/test"),
    (e: unknown) =>
      e instanceof UserError &&
      e.notices[0].code === "x.invalidProfileUrl" &&
      e.message === "Use an X username or an https://x.com profile URL.",
  );
  const result = parseXTimeline(
    `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { timeline: { entries: [] } } } })}</script>`,
    "test",
    "c",
  );
  assert.deepEqual(result.warningNotices, [{ code: "x.snapshotLimited" }]);
  assert.equal(noticesText(result.warningNotices!), result.warning);
});
