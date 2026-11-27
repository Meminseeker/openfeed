import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentUrl,
  playlistId,
  importPlaylist,
  playlistPage,
  resolveSharedUrl,
} from "../server/library.ts";
import { noticesText } from "../src/notices/index.ts";
import { expiredPost, retentionDays } from "../server/retention.ts";
test("content links normalize supported platforms and discard tracking parameters", () => {
  for (const [url, platform, id] of [
    ["https://youtu.be/abcdefghijk?si=track", "youtube", "abcdefghijk"],
    ["https://www.youtube.com/shorts/abcdefghijk", "youtube", "abcdefghijk"],
    ["https://x.com/test/status/123?s=20", "x", "123"],
    ["https://instagram.com/reel/ABC_123/?igsh=x", "instagram", "ABC_123"],
    [
      "https://www.tiktok.com/@baby._.vibz/video/7701241895976013088",
      "tiktok",
      "7701241895976013088",
    ],
  ]) {
    const result = contentUrl(url);
    assert.equal(result.platform, platform);
    assert.equal(result.id, id);
    assert.ok(!result.url.includes("track"));
  }
  for (const url of [
    "https://localhost/a",
    "https://youtube.com:4433/watch?v=abcdefghijk",
    "https://youtube.com.evil/a",
    "file:///tmp/test",
    "https://instagram.com/username/",
  ])
    assert.throws(() => contentUrl(url));
  assert.equal(
    playlistId(
      "https://youtube.com/playlist?list=PLns7Jmm7BK82IGYKmzmUv8PCEUGzf-WMe",
    ),
    "PLns7Jmm7BK82IGYKmzmUv8PCEUGzf-WMe",
  );
});
test("playlist pages include old and modern cards, exclude unavailable videos and retain old content", () => {
  const data = {
    contents: {
      items: [
        {
          playlistVideoRenderer: {
            videoId: "abcdefghijk",
            title: { simpleText: "Old video" },
          },
        },
        {
          playlistVideoRenderer: { videoId: "unavailable", isPlayable: false },
        },
        {
          lockupViewModel: {
            contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
            contentId: "lmnopqrstuv",
            metadata: {
              lockupMetadataViewModel: { title: { content: "Modern video" } },
            },
          },
        },
        {
          continuationItemRenderer: {
            continuationEndpoint: { continuationCommand: { token: "more" } },
          },
        },
      ],
    },
  };
  const result = playlistPage(data, "creator");
  assert.deepEqual(
    new Set(result.posts.map((p) => p.id)),
    new Set(["abcdefghijk", "lmnopqrstuv"]),
  );
  assert.equal(result.continuation, "more");
  const post = { ...result.posts[0], published: "2000-01-01T00:00:00Z" };
  assert.equal(expiredPost(post, 7), false);
  assert.equal(
    expiredPost({ ...post, libraryOnly: false, linked: true }, 7),
    false,
  );
  assert.equal(
    expiredPost({ ...post, libraryOnly: false, playlistIds: ["p"] }, 7),
    false,
  );
  assert.equal(expiredPost({ ...post, libraryOnly: false }, 7), true);
  assert.equal(retentionDays(undefined), 7);
});
test("TikTok share links cannot redirect to an arbitrary server", async () => {
  const original = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = async (input) => {
    seen.push(String(input));
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/secrets" },
    });
  };
  try {
    await assert.rejects(
      resolveSharedUrl("https://vm.tiktok.com/short"),
      /redirect/,
    );
    assert.equal(seen.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("individual Instagram and TikTok imports use verified public content, never fabricate an error response", async () => {
  const { importLink } = await import("../server/library.ts");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) =>
      String(input).includes("instagram.com")
        ? new Response(
            `<script type="application/json">${JSON.stringify({ xdt_shortcode_media: { shortcode: "ABC123", owner: { username: "creator", is_private: false }, edge_media_to_caption: { edges: [{ node: { text: "Full Instagram caption" } }] }, display_url: "https://scontent.cdninstagram.com/photo.jpg", taken_at_timestamp: 1600000000 } })}</script>`,
          )
        : String(input).includes("/oembed?")
          ? Response.json({
              author_name: "creator",
              title: "TikTok caption",
              html: '<blockquote data-video-id="7701241895976013088"></blockquote>',
            })
          : new Response("blocked", { status: 503 });
    const ig = await importLink("https://instagram.com/p/ABC123/");
    assert.equal(ig.post.text, "Full Instagram caption");
    assert.equal(ig.post.images?.length, 1);
    assert.equal(ig.post.libraryOnly, true);
    const tt = await importLink(
      "https://www.tiktok.com/@creator/video/7701241895976013088",
    );
    assert.equal(tt.post.videoId, "7701241895976013088");
    assert.equal(tt.post.title, "TikTok caption");
    globalThis.fetch = async (input) =>
      String(input).includes("/oembed?")
        ? Response.json({ status_code: 400, status_msg: "Unavailable" })
        : new Response("blocked", { status: 503 });
    await assert.rejects(
      importLink("https://www.tiktok.com/@creator/video/7701241895976013088"),
      /did not expose/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("library errors carry notices whose English matches the message", async () => {
  assert.throws(
    () => contentUrl("http://youtube.com/watch?v=abcdefghijk"),
    (e: any) =>
      e.notices?.[0]?.code === "library.httpsLinkRequired" &&
      e.message ===
        "Paste an HTTPS link from YouTube, X, Instagram, TikTok or LinkedIn.",
  );
  assert.throws(
    () => playlistId("not a link"),
    (e: any) =>
      e.notices?.[0]?.code === "library.invalidUrl" &&
      e.message === "Invalid URL",
  );
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/secrets" },
    });
  try {
    await assert.rejects(
      resolveSharedUrl("https://vm.tiktok.com/short"),
      (e: any) =>
        e.notices?.[0]?.code === "library.invalidTikTokRedirect" &&
        e.message === "Invalid TikTok redirect.",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("playlist warnings carry notices whose text equals the English warning", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/watch?v=")) return new Response("gone", { status: 404 });
    if (url.includes("/youtubei/v1/browse"))
      return new Response("error", { status: 500 });
    return new Response(
      "var ytInitialData = " +
        JSON.stringify({
          metadata: { playlistMetadataRenderer: { title: "Example playlist" } },
          contents: [
            {
              playlistVideoRenderer: {
                videoId: "M4TB50FtID4",
                title: { simpleText: "Video" },
              },
            },
            {
              continuationItemRenderer: {
                continuationEndpoint: {
                  continuationCommand: { token: "next" },
                },
              },
            },
          ],
        }) +
        ";",
    );
  };
  try {
    const { playlist } = await importPlaylist(
      "https://www.youtube.com/playlist?list=PL0gMcF5aNgrPlva_HNnUZgst-oICYDmSW",
    );
    assert.equal(
      playlist.warning,
      "Some playlist pages could not load. Refresh this playlist to retry. Exact publication dates unavailable for 1 videos; their chronological order may be approximate. Refresh to retry.",
    );
    assert.deepEqual(
      playlist.warningNotices?.map((n) => n.code),
      ["library.playlistPagesFailed", "library.playlistDatesMissing"],
    );
    assert.equal(noticesText(playlist.warningNotices!), playlist.warning);
  } finally {
    globalThis.fetch = original;
  }
});

test("playlist pagination follows commandExecutorCommand tokens and passes INNERTUBE_API_KEY", async () => {
  const original = globalThis.fetch;
  const browseRequests: { url: string; body: any }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/watch?v=")) {
      const id = new URL(url).searchParams.get("v")!;
      return new Response(
        `var ytInitialPlayerResponse = ${JSON.stringify({
          videoDetails: { videoId: id, title: `Original ${id}` },
          microformat: {
            playerMicroformatRenderer: { publishDate: "2026-01-10T10:00:00Z" },
          },
        })};`,
      );
    }
    if (url.includes("/youtubei/v1/browse")) {
      const body = JSON.parse(String(init?.body || "{}"));
      browseRequests.push({ url, body });
      if (body.continuation === "tok-page-2") {
        return Response.json({
          onResponseReceivedActions: [
            {
              appendContinuationItemsAction: {
                continuationItems: [
                  {
                    playlistVideoRenderer: {
                      videoId: "BBBBBBBBBBB",
                      title: { simpleText: "Translated B" },
                    },
                  },
                  {
                    continuationItemRenderer: {
                      continuationEndpoint: {
                        commandExecutorCommand: {
                          commands: [
                            { continuationCommand: { token: "tok-page-3" } },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        });
      }
      return Response.json({
        onResponseReceivedActions: [
          {
            appendContinuationItemsAction: {
              continuationItems: [
                {
                  playlistVideoRenderer: {
                    videoId: "CCCCCCCCCCC",
                    title: { simpleText: "Translated C" },
                  },
                },
              ],
            },
          },
        ],
      });
    }
    return new Response(
      `<script>ytcfg.set({"INNERTUBE_API_KEY":"TESTKEY123","INNERTUBE_CONTEXT":{"client":{"clientName":"WEB","clientVersion":"2.20261101.00.00"}}});</script>` +
        `var ytInitialData = ${JSON.stringify({
          metadata: { playlistMetadataRenderer: { title: "Big playlist" } },
          contents: [
            {
              playlistVideoRenderer: {
                videoId: "AAAAAAAAAAA",
                title: { simpleText: "Translated A" },
              },
            },
            {
              continuationItemRenderer: {
                continuationEndpoint: {
                  commandExecutorCommand: {
                    commands: [
                      { clickTrackingParams: "xyz" },
                      { continuationCommand: { token: "tok-page-2" } },
                    ],
                  },
                },
              },
            },
          ],
        })};`,
    );
  };
  try {
    const { playlist, posts } = await importPlaylist(
      "https://www.youtube.com/playlist?list=PL0gMcF5aNgrPlva_HNnUZgst-oICYDmSW",
    );
    assert.deepEqual(playlist.postIds, [
      "AAAAAAAAAAA",
      "BBBBBBBBBBB",
      "CCCCCCCCCCC",
    ]);
    assert.equal(browseRequests.length, 2);
    assert.ok(browseRequests[0].url.includes("?key=TESTKEY123"));
    assert.equal(posts[0].title, "Original AAAAAAAAAAA");
    assert.equal(posts[1].title, "Original BBBBBBBBBBB");
    assert.equal(posts[2].title, "Original CCCCCCCCCCC");
    assert.equal(playlist.warning, undefined);
  } finally {
    globalThis.fetch = original;
  }
});
