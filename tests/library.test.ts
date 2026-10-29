import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentUrl,
  playlistId,
  playlistPage,
  resolveSharedUrl,
} from "../server/library.ts";
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
