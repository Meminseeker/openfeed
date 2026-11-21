import { test } from "node:test";
import assert from "node:assert/strict";
import { errorNotices, noticesText } from "../src/notices/index.ts";
import {
  instagramUsername,
  instagramPosts,
  parseInstagramProfile,
  syncInstagram,
  instagramMediaStale,
  embeddedImage,
  refreshInstagramMedia,
} from "../server/instagram.ts";
const image = "https://scontent.cdninstagram.com/one.jpg",
  video = "https://video.xx.fbcdn.net/video.mp4";
const album = {
  id: "123",
  shortcode: "Album_1",
  owner: { username: "test" },
  edge_media_to_caption: { edges: [{ node: { text: "Album caption" } }] },
  taken_at_timestamp: 1791072000,
  edge_sidecar_to_children: {
    edges: [
      { node: { display_url: image } },
      { node: { display_url: "https://scontent.cdninstagram.com/two.jpg" } },
      { node: { is_video: true, video_url: video, display_url: image } },
    ],
  },
};
const html = (is_private = false) =>
  `<script type="application/json">${JSON.stringify({ data: { user: { username: "test", is_private, edge_owner_to_timeline_media: { edges: [{ node: album }] } } } })}</script>`;
test("Instagram accepts only profile handles and owned-domain HTTPS profile URLs", () => {
  assert.equal(
    instagramUsername("https://www.instagram.com/Test.name/"),
    "test.name",
  );
  for (const value of [
    "https://evil.test/test",
    "https://instagram.com/p/abc/",
    "https://instagram.com:444/test",
    "https://user@instagram.com/test",
    "../test",
    "a..b",
    "accounts",
    "a.",
  ])
    assert.throws(() => instagramUsername(value));
});
test("Instagram albums preserve photos and video attachments; excludes other authors, ads and disabled types", () => {
  const posts = instagramPosts(
    [
      album,
      { ...album, shortcode: "other", owner: { username: "other" } },
      { ...album, shortcode: "ad", is_ad: true },
    ],
    "test",
    "c",
    ["post"],
  );
  assert.equal(posts.length, 1);
  assert.equal(posts[0].id, "instagram:Album_1");
  assert.equal(posts[0].platform, "instagram");
  assert.equal(posts[0].text, "Album caption");
  assert.equal(posts[0].images?.length, 2);
  assert.equal(posts[0].videos?.[0].url, video);
  assert.deepEqual(instagramPosts([album], "test", "c", ["short"]), []);
  const reel = {
    id: "456",
    permalink: "https://www.instagram.com/reel/Reel1/",
    media_type: "VIDEO",
    media_product_type: "REELS",
    media_url: video,
    thumbnail_url: image,
  };
  assert.equal(instagramPosts([reel], "test", "c", ["short"])[0].kind, "short");
  assert.equal(
    instagramPosts([{ ...reel, media_product_type: "FEED" }], "test", "c", [
      "video",
    ])[0].kind,
    "video",
  );
});
test("Instagram rejects private or blocked pages and ignores unsafe media and source URLs", () => {
  assert.equal(
    parseInstagramProfile(html(), "test", "c", ["post"]).posts.length,
    1,
  );
  assert.throws(
    () => parseInstagramProfile(html(true), "test", "c", ["post"]),
    /Private/,
  );
  assert.throws(
    () => parseInstagramProfile(html(true), "test", "c", ["post"]),
    (e) =>
      errorNotices(e)?.[0]?.code === "instagram.privateAccount" &&
      (e as Error).message === "Private Instagram accounts are not supported.",
  );
  const preview = parseInstagramProfile(html(), "test", "c", ["post"]);
  assert.equal(noticesText(preview.warningNotices!), preview.warning);
  assert.throws(
    () => parseInstagramProfile("Login", "test", "c", ["post"]),
    /did not expose/,
  );
  assert.deepEqual(
    instagramPosts(
      [{ id: "1", permalink: "https://evil.test/p/abc/" }],
      "test",
      "c",
      ["post"],
    ),
    [],
  );
  assert.equal(
    instagramPosts(
      [
        {
          id: "1",
          shortcode: "abc",
          display_url: "https://cdninstagram.com.evil.test/one.jpg",
        },
      ],
      "test",
      "c",
      ["post"],
    )[0].images?.length,
    0,
  );
});
test("Meta Business Discovery uses server-only auth, bounded media, and validates profile identity", async () => {
  const original = globalThis.fetch;
  const keys = [
    "INSTAGRAM_ACCESS_TOKEN",
    "INSTAGRAM_USER_ID",
    "INSTAGRAM_GRAPH_VERSION",
  ];
  const old = keys.map((k) => process.env[k]);
  Object.assign(process.env, {
    INSTAGRAM_ACCESS_TOKEN: "test-token",
    INSTAGRAM_USER_ID: "123",
    INSTAGRAM_GRAPH_VERSION: "v24.0",
  });
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.hostname, "graph.facebook.com");
    assert.ok(url.searchParams.get("fields")?.includes("media.limit(30)"));
    assert.ok(!url.href.includes("test-token"));
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-token",
    );
    return Response.json({
      business_discovery: {
        username: "test",
        media: {
          data: [
            {
              id: "123",
              caption: "API caption",
              permalink: "https://www.instagram.com/p/Album_1/",
              media_type: "CAROUSEL_ALBUM",
              children: {
                data: [
                  { media_type: "IMAGE", media_url: image },
                  {
                    media_type: "VIDEO",
                    media_url: video,
                    thumbnail_url: image,
                  },
                ],
              },
            },
          ],
        },
      },
    });
  };
  try {
    const result = await syncInstagram("test", "c", ["post"]);
    assert.equal(result.posts[0].id, "instagram:Album_1");
    assert.equal(result.posts[0].videos?.length, 1);
    assert.equal(calls, 1);
    await syncInstagram("test", "c", []);
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      Response.json({
        business_discovery: { username: "other", media: { data: [] } },
      });
    await assert.rejects(
      syncInstagram("test", "c", ["post"]),
      /did not return/,
    );
    globalThis.fetch = async () => new Response("", { status: 401 });
    await assert.rejects(syncInstagram("test", "c", ["post"]), /401/);
    await assert.rejects(syncInstagram("test", "c", ["post"]), (e) => {
      assert.deepEqual(errorNotices(e), [
        { code: "instagram.apiUnavailable", params: { status: 401 } },
      ]);
      return true;
    });
  } finally {
    globalThis.fetch = original;
    keys.forEach((key, i) =>
      old[i] === undefined
        ? delete process.env[key]
        : (process.env[key] = old[i]),
    );
  }
});
test("public profile embed parses nested JSON safely and isolates the approved owner", () => {
  const embedded = {
    context: {
      graphql_media: [
        { shortcode_media: album },
        {
          shortcode_media: {
            ...album,
            shortcode: "foreign",
            owner: { username: "other", is_private: false },
          },
        },
      ],
    },
  };
  const payload = {
    require: [
      ["Embed", "mount", [], [{ contextJSON: JSON.stringify(embedded) }]],
    ],
  };
  const page = `<script>requireLazy([],function(){s.handle(${JSON.stringify(payload)});throw new Error("must not execute");});</script>`;
  // A real embed verifies public status on each top-level media's owner.
  const publicAlbum = {
    ...album,
    owner: { username: "test", is_private: false },
  };
  const publicPayload = {
    contextJSON: JSON.stringify({
      context: {
        graphql_media: [
          { shortcode_media: publicAlbum },
          {
            shortcode_media: {
              ...album,
              shortcode: "foreign",
              owner: { username: "other", is_private: false },
            },
          },
        ],
      },
    }),
  };
  const result = parseInstagramProfile(
    `<script>s.handle(${JSON.stringify(publicPayload)});</script>`,
    "test",
    "c",
    ["post"],
  );
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].images?.length, 2);
  assert.throws(
    () => parseInstagramProfile(page, "test", "c", ["post"]),
    /did not expose/,
  );
});
test("anonymous Instagram sync uses embeds, enriches video/Reels and respects paused sources", async () => {
  const original = globalThis.fetch;
  const old = [
    process.env.INSTAGRAM_ACCESS_TOKEN,
    process.env.INSTAGRAM_USER_ID,
  ];
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
  delete process.env.INSTAGRAM_USER_ID;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    assert.equal(init?.credentials, undefined);
    assert.ok(!(init?.headers as Record<string, string>).Authorization);
    const base = {
      ...album,
      shortcode: "video1",
      is_video: true,
      edge_sidecar_to_children: undefined,
      owner: { username: "test", is_private: false },
    };
    const m = url.endsWith("/test/embed/")
      ? base
      : {
          ...base,
          product_type: "clips",
          video_url: video,
          display_url: image,
        };
    return new Response(
      `<script>s.handle(${JSON.stringify({ contextJSON: JSON.stringify({ context: { graphql_media: [{ shortcode_media: m }] } }) })});</script>`,
    );
  };
  try {
    const result = await syncInstagram("test", "c", ["short"]);
    assert.equal(result.posts[0].kind, "short");
    assert.equal(noticesText(result.warningNotices!), result.warning);
    assert.equal(result.posts[0].videos?.[0].url, video);
    assert.equal(
      result.posts[0].published,
      new Date(album.taken_at_timestamp * 1000).toISOString(),
    );
    assert.deepEqual(requests, [
      "https://www.instagram.com/test/embed/",
      "https://www.instagram.com/p/video1/embed/captioned/",
    ]);
    requests.length = 0;
    await syncInstagram("test", "c", []);
    assert.equal(requests.length, 0);
    requests.length = 0;
    await syncInstagram("test", "c", ["post"]);
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = original;
    if (old[0] === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN;
    else process.env.INSTAGRAM_ACCESS_TOKEN = old[0];
    if (old[1] === undefined) delete process.env.INSTAGRAM_USER_ID;
    else process.env.INSTAGRAM_USER_ID = old[1];
  }
});
test("collaboration details enrich only a listed public shortcode and retain the approved source", async () => {
  const original = globalThis.fetch;
  const old = [
    process.env.INSTAGRAM_ACCESS_TOKEN,
    process.env.INSTAGRAM_USER_ID,
  ];
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
  delete process.env.INSTAGRAM_USER_ID;
  const base = {
    ...album,
    shortcode: "collab",
    is_video: true,
    edge_sidecar_to_children: undefined,
    owner: { username: "test", is_private: false },
  };
  let detail = {
    ...base,
    owner: { username: "originalauthor", is_private: false },
    video_url: video,
  };
  const html = (m: unknown) =>
    `<script type="application/json">${JSON.stringify({ shortcode_media: m })}</script>`;
  globalThis.fetch = async (input) =>
    new Response(html(String(input).endsWith("/test/embed/") ? base : detail));
  try {
    const result = await syncInstagram("test", "c", ["video"]);
    assert.equal(result.posts[0].videos?.[0].url, video);
    assert.equal(result.posts[0].sourceUsername, "test");
    detail = { ...detail, shortcode: "unrelated" };
    const partial = await syncInstagram("test", "c", ["video"]);
    assert.equal(partial.posts[0].videos?.length, 0);
    assert.equal(
      partial.warning,
      "Instagram profile embeds expose only a small recent preview (usually 6 posts); a complete timeline is not guaranteed. Some video details were unavailable; use Open source.",
    );
    assert.equal(noticesText(partial.warningNotices!), partial.warning);
    assert.deepEqual(
      partial.warningNotices?.map((n) => n.code),
      ["instagram.embedPreviewOnly", "instagram.videoDetailsUnavailable"],
    );
    detail = {
      ...detail,
      shortcode: "collab",
      owner: { username: "originalauthor", is_private: true },
    };
    assert.equal(
      (await syncInstagram("test", "c", ["video"])).posts[0].videos?.length,
      0,
    );
  } finally {
    globalThis.fetch = original;
    ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID"].forEach((k, i) =>
      old[i] === undefined ? delete process.env[k] : (process.env[k] = old[i]),
    );
  }
});

const oe = (ms: number) =>
  Math.floor(ms / 1000)
    .toString(16)
    .toUpperCase();
const refreshNow = Date.parse("2026-11-20T12:00:00Z");
const signed = (name: string, expires: number) =>
  `https://scontent.cdninstagram.com/${name}.jpg?oe=${oe(expires)}`;
async function withInstagramPage<T>(
  html: string,
  run: (urls: string[]) => Promise<T>,
) {
  const oldFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: any) => {
    urls.push(String(input));
    return new Response(html, { status: 200 });
  }) as typeof fetch;
  try {
    return await run(urls);
  } finally {
    globalThis.fetch = oldFetch;
  }
}
const storedPost = (id: string, extra: any = {}) => ({
  id,
  creatorId: "creator",
  platform: "instagram" as const,
  sourceUsername: "test",
  title: "Stored",
  url: "https://www.instagram.com/p/abc/",
  kind: "post" as const,
  published: "2026-11-10T00:00:00.000Z",
  read: false,
  saved: true,
  ...extra,
});

test("Instagram media is stale when any signed link expires within 12 hours or has no expiry", () => {
  const later = refreshNow + 3 * 86400000;
  assert.equal(
    instagramMediaStale({ image: signed("a", later) }, refreshNow),
    false,
  );
  assert.equal(
    instagramMediaStale(
      {
        image: signed("a", later),
        videos: [{ url: signed("v", refreshNow + 3600000) }],
      },
      refreshNow,
    ),
    true,
  );
  assert.equal(instagramMediaStale({ image: image }, refreshNow), true);
  assert.equal(instagramMediaStale({}, refreshNow), true);
});

test("opening an Instagram post with fresh links does not contact Instagram", async () => {
  await withInstagramPage("", async (urls) => {
    const post = storedPost("instagram:abc", {
      image: signed("a", refreshNow + 3 * 86400000),
    });
    assert.equal(await refreshInstagramMedia(post, refreshNow), undefined);
    assert.equal(urls.length, 0);
  });
});

test("expired Instagram video and carousel links are renewed from the public post embed JSON", async () => {
  const later = refreshNow + 2 * 86400000;
  const page = `<script type="application/json">${JSON.stringify({
    shortcode_media: {
      shortcode: "abc",
      is_video: true,
      product_type: "clips",
      display_url: signed("poster", later),
      video_url: `https://video.xx.fbcdn.net/new.mp4?oe=${oe(later)}`,
      owner: { username: "someone-else", is_private: false },
    },
  })}</script>`;
  await withInstagramPage(page, async (urls) => {
    const fresh = await refreshInstagramMedia(
      storedPost("instagram:abc", {
        image: signed("old", refreshNow - 86400000),
        videos: [{ url: "https://video.xx.fbcdn.net/old.mp4" }],
      }),
      refreshNow,
    );
    assert.deepEqual(urls, [
      "https://www.instagram.com/p/abc/embed/captioned/",
    ]);
    assert.equal(
      fresh?.videos?.[0].url,
      `https://video.xx.fbcdn.net/new.mp4?oe=${oe(later)}`,
    );
    assert.equal(fresh?.image, signed("poster", later));
  });
});

test("single-image Instagram posts are renewed from the embedded image, preferring the largest size", async () => {
  const later = refreshNow + 2 * 86400000;
  const page = `<img class="EmbeddedMediaImage" alt="x" src="${signed("small", later)}&amp;a=1" srcset="${signed("w640", later)} 640w,${signed("w1080", later)}&amp;b=2 1080w">`;
  assert.equal(embeddedImage(page), `${signed("w1080", later)}&b=2`);
  assert.equal(
    embeddedImage(
      `<img class="EmbeddedMediaImage" src="https://evil.test/a.jpg">`,
    ),
    undefined,
  );
  await withInstagramPage(page, async () => {
    const fresh = await refreshInstagramMedia(
      storedPost("instagram:img1", {
        image: signed("old", refreshNow - 1),
        images: [signed("old", refreshNow - 1)],
      }),
      refreshNow,
    );
    assert.deepEqual(fresh?.images, [`${signed("w1080", later)}&b=2`]);
  });
});

test("Instagram media refresh ignores malformed ids and backs off after a failure", async () => {
  await withInstagramPage("<html></html>", async (urls) => {
    assert.equal(
      await refreshInstagramMedia(storedPost("instagram:../x"), refreshNow),
      undefined,
    );
    assert.equal(urls.length, 0);
    const post = storedPost("instagram:gone1", { image: image });
    await assert.rejects(
      refreshInstagramMedia(post, refreshNow),
      /did not expose/,
    );
    assert.equal(
      await refreshInstagramMedia(post, refreshNow + 60000),
      undefined,
    );
    assert.equal(urls.length, 1);
  });
});
