import { test } from "node:test";
import assert from "node:assert/strict";
import { channelPath, initialData, publicPosts } from "../server/youtube.ts";
test("accepts channel IDs, handles, and YouTube URLs without allowing arbitrary hosts", () => {
  assert.equal(channelPath("@mkbhd"), "@mkbhd");
  assert.equal(channelPath("mkbhd"), "@mkbhd");
  assert.equal(channelPath("https://www.youtube.com/@mkbhd/videos"), "@mkbhd");
  assert.equal(
    channelPath("https://youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ"),
    "channel/UCBJycsmduvYEL83R_U4JriQ",
  );
  for (const s of [
    "https://evil.test/@mkbhd",
    "https://youtube.com.evil.test/@mkbhd",
    "../admin",
    "https://youtube.com/watch?v=abc",
    "",
  ])
    assert.throws(() => channelPath(s));
});
test("extracts balanced initial data with braces, escaped quotes, and semicolons in text", () => {
  const fixture = { title: 'a } ; " quotation', nested: { a: [1, 2] } };
  assert.deepEqual(
    initialData(
      `<script>var ytInitialData = ${JSON.stringify(fixture)}; other();</script>`,
    ),
    fixture,
  );
  assert.throws(() => initialData("<html>consent</html>"));
  assert.throws(() => initialData('var ytInitialData = {"a": 1'));
});
test("extracts and deduplicates Shorts with old and new public page renderers", () => {
  const data = {
    a: {
      reelItemRenderer: {
        videoId: "abc",
        headline: { simpleText: "Short one" },
      },
    },
    b: {
      shortsLockupViewModel: {
        onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: "def" } } },
        overlayMetadata: { primaryText: { content: "Short two" } },
      },
    },
    c: {
      reelItemRenderer: {
        videoId: "abc",
        headline: { simpleText: "Short one" },
      },
    },
  };
  const p = publicPosts(data, "creator", "short");
  assert.equal(p.length, 2);
  assert.equal(p[1].title, "Short two");
  assert.equal(p[0].kind, "short");
  assert.equal(p[0].published, "");
});
test("imports public community text and images with approximate dates", () => {
  const data = {
    backstagePostRenderer: {
      postId: "Ug123",
      contentText: { runs: [{ text: "Hello " }, { text: "world" }] },
      publishedTimeText: { runs: [{ text: "2 days ago (edited)" }] },
      backstageAttachment: {
        backstageImageRenderer: {
          image: { thumbnails: [{ url: "https://example.com/image" }] },
        },
      },
    },
  };
  const [p] = publicPosts(data, "creator", "community");
  assert.equal(p.text, "Hello world");
  assert.equal(p.image, "https://example.com/image");
  assert.equal(p.url, "https://www.youtube.com/post/Ug123");
  assert.ok(Date.now() - Date.parse(p.published) > 86400000);
});
test("community import excludes posts by unapproved viewers and unselected tabs", () => {
  const post = (id: string, author: string) => ({
    backstagePostRenderer: {
      postId: id,
      authorEndpoint: { browseEndpoint: { browseId: author } },
      contentText: { simpleText: id },
    },
  });
  const data = {
    tabs: [
      {
        tabRenderer: {
          selected: true,
          content: [post("own", "approved"), post("viewer", "stranger")],
        },
      },
      { tabRenderer: { content: post("recommendation", "approved") } },
    ],
  };
  const p = publicPosts(data, "creator", "community", "approved");
  assert.deepEqual(
    p.map((p) => p.id),
    ["own"],
  );
});
test("imports modern long-form video cards with duration and date", () => {
  const data = {
    lockupViewModel: {
      contentId: "abc123",
      contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
      metadata: {
        lockupMetadataViewModel: {
          title: { content: "A video" },
          metadata: {
            contentMetadataViewModel: {
              metadataRows: [
                { metadataParts: [{ accessibilityLabel: "3 days ago" }] },
              ],
            },
          },
        },
      },
      contentImage: {
        thumbnailViewModel: {
          overlays: [{ thumbnailBadgeViewModel: { text: "20:44" } }],
        },
      },
    },
  };
  const [p] = publicPosts(data, "creator", "video");
  assert.equal(p.title, "A video");
  assert.equal(p.duration, "20:44");
  assert.ok(p.published);
  assert.equal(p.publishedApproximate, true);
});
test("video cards tolerate metadata rows without parts", () => {
  const [p] = publicPosts(
    {
      lockupViewModel: {
        contentId: "abc",
        contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
        metadata: {
          lockupMetadataViewModel: {
            title: { content: "A video" },
            metadata: {
              contentMetadataViewModel: {
                metadataRows: [{}, { metadataParts: [undefined] }],
              },
            },
          },
        },
      },
    },
    "creator",
    "video",
  );
  assert.equal(p.title, "A video");
  assert.equal(p.published, "");
});
