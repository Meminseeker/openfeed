import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linkedinIdDate,
  linkedinPostRef,
  linkedinUsername,
  parseLinkedInEmbed,
  parseLinkedInProfile,
  syncLinkedIn,
} from "../server/linkedin.ts";
import { contentUrl, importLink } from "../server/library.ts";
import { cleanPastedUrl } from "../src/clean-url.ts";
import type { Post } from "../src/types.ts";

// Synthetic pages modelled on LinkedIn's logged-out markup (no real profile data).
const CDN = "https://media.licdn.com/dms/image/v2";
const ID1 = "7493241729081315328"; // 2026-08-12T09:47:25.912Z
const ID2 = "7506371081604255744";
const ld = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const author = {
  "@type": "Person",
  name: "Ada Example",
  url: "https://tr.linkedin.com/in/ada-example",
};
const posting = (id: string, extra: Record<string, unknown> = {}) => ({
  "@context": "https://schema.org",
  "@type": "DiscussionForumPosting",
  author,
  datePublished: "2026-08-12T09:47:25.857Z",
  text: `First line for ${id}\n\nMore text`,
  url: `https://tr.linkedin.com/posts/ada-example_first-line-activity-${id}-cjjH`,
  ...extra,
});
const profilePage = (posts: unknown[]) =>
  `<html><head>${ld({
    "@context": "http://schema.org",
    "@graph": [
      ...posts,
      {
        "@type": "Person",
        name: "Ada Example",
        url: "https://tr.linkedin.com/in/ada-example",
        image: {
          "@type": "ImageObject",
          contentUrl: `${CDN}/avatar/profile-displayphoto-shrink_200_200/0/1?e=2147483647&v=beta&t=a`,
        },
      },
    ],
  })}</head><body></body></html>`;
const embedPage = (body: string) =>
  `<html><body><article data-activity-urn="urn:li:activity:${ID1}">
  <a href="https://tr.linkedin.com/in/ada-example?trk=public_post_embed_feed-actor-image"><div role="img" data-delayed-url="${CDN}/avatar/profile-displayphoto-shrink_400_400/0/1?e=2147483647&amp;v=beta&amp;t=b"></div></a>
  <a class="text-sm" href="https://tr.linkedin.com/in/ada-example?trk=public_post_embed_feed-actor-name" data-tracking-control-name="public_post_embed_feed-actor-name"> Ada Example </a>
  <p class="attributed-text-segment-list__content" data-test-id="main-feed-activity-embed-card__commentary">Line &amp; one
Line two <a href="https://www.linkedin.com/redir/redirect?url=x">https://example.com</a></p>
  ${body}</article></body></html>`;
const videoTag = `<video class="share-native-video__node" data-sources="${JSON.stringify(
  [
    {
      src: "https://dms.licdn.com/playlist/vid/v2/X/mp4-640p/0/1?e=2147483647&v=beta&t=low",
      type: "video/mp4",
      "data-bitrate": 89572,
    },
    {
      src: "https://dms.licdn.com/playlist/vid/v2/X/mp4-720p/0/1?e=2147483647&v=beta&t=high",
      type: "video/mp4",
      "data-bitrate": 113014,
    },
    {
      src: "https://evil.example/v.mp4",
      type: "video/mp4",
      "data-bitrate": 9e9,
    },
  ],
)
  .replaceAll("&", "&amp;")
  .replaceAll(
    '"',
    "&quot;",
  )}" data-poster-url="${CDN}/X/videocover-high/0/1?e=2147483647&amp;v=beta&amp;t=p" playsinline></video>`;
const photoList = `<ul class="feed-images-content" data-test-id="feed-images-content">
  <li><img data-delayed-url="${CDN}/P1/feedshare-shrink_800/0/1?e=2147483647&amp;v=beta&amp;t=1"></li>
  <li><img data-delayed-url="${CDN}/P2/feedshare-shrink_800/0/1?e=2147483647&amp;v=beta&amp;t=2"></li>
  <li><img data-delayed-url="https://evil.example/x.jpg"></li>
</ul>`;
const articleCard = `<a class="feed-article-content" data-test-id="article-content" role="button"><img alt="Site" data-delayed-url="${CDN}/A/articleshare-shrink_800/0/1?e=2147483647&amp;v=beta&amp;t=a"></a>`;

test("LinkedIn profile names accept slugs and /in/ URLs and reject other pages", () => {
  assert.equal(linkedinUsername("Ada-Example"), "ada-example");
  assert.equal(
    linkedinUsername("https://tr.linkedin.com/in/Ada-Example/"),
    "ada-example",
  );
  assert.equal(
    linkedinUsername("https://www.linkedin.com/in/J%C3%BCrgen-M%C3%BCller-123"),
    "jürgen-müller-123",
  );
  for (const input of [
    "https://evil.com/in/ada",
    "https://linkedin.com.evil.com/in/ada",
    "http://www.linkedin.com/in/ada-example",
    "https://user@www.linkedin.com/in/ada-example",
    "https://www.linkedin.com:8443/in/ada-example",
    "https://www.linkedin.com/company/acme/",
    "https://www.linkedin.com/posts/ada_x-activity-7493241729081315328-a",
    "ab",
    "bad/name",
    "-leading",
    "",
  ])
    assert.throws(() => linkedinUsername(input), input);
});

test("LinkedIn post references parse post and feed URLs and dates come from ids", () => {
  assert.deepEqual(
    linkedinPostRef(
      `https://tr.linkedin.com/posts/ada-example_bug%C3%BCn-activity-${ID1}-qmeM?utm_source=share`,
    ),
    {
      type: "activity",
      id: ID1,
      url: `https://www.linkedin.com/posts/ada-example_bug%C3%BCn-activity-${ID1}-qmeM`,
    },
  );
  assert.deepEqual(
    linkedinPostRef(
      `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ID2}/`,
    ),
    {
      type: "ugcPost",
      id: ID2,
      url: `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ID2}/`,
    },
  );
  assert.equal(
    linkedinPostRef("https://www.linkedin.com/in/ada-example/"),
    undefined,
  );
  assert.equal(
    linkedinPostRef(`https://evil.com/feed/update/urn:li:activity:${ID1}`),
    undefined,
  );
  assert.equal(linkedinIdDate(ID1), "2026-08-12T09:47:25.912Z");
  assert.equal(linkedinIdDate("1"), "");
  assert.equal(linkedinIdDate(ID1, Date.UTC(2020, 0, 1)), "");
});

test("LinkedIn profiles yield the owner's own posts with exact dates and the profile photo", () => {
  const result = parseLinkedInProfile(
    profilePage([
      posting(ID1),
      posting(ID1),
      posting(ID2, {
        datePublished: "not a date",
        text: "",
        headline: "Headline",
      }),
      posting("7400000000000000000", {
        author: {
          "@type": "Person",
          name: "Other",
          url: "https://www.linkedin.com/in/other",
        },
      }),
      posting("7400000000000000001", {
        url: "https://evil.com/posts/x-activity-7400000000000000001-a",
      }),
    ]),
    "https://www.linkedin.com/in/ada-example/",
    "creator",
  );
  assert.deepEqual(
    result.posts.map((p) => p.id),
    [`linkedin:${ID1}`, `linkedin:${ID2}`],
  );
  const [first, second] = result.posts;
  assert.equal(first.platform, "linkedin");
  assert.equal(first.kind, "post");
  assert.equal(first.creatorId, "creator");
  assert.equal(first.sourceUsername, "ada-example");
  assert.equal(first.title, `First line for ${ID1}`);
  assert.equal(first.published, "2026-08-12T09:47:25.857Z");
  assert.equal(first.publishedApproximate, undefined);
  assert.equal(
    first.url,
    `https://www.linkedin.com/posts/ada-example_first-line-activity-${ID1}-cjjH`,
  );
  assert.equal(second.title, "Headline");
  assert.equal(second.published, linkedinIdDate(ID2));
  assert.equal(result.name, "Ada Example");
  assert.match(
    result.avatar!,
    /^https:\/\/media\.licdn\.com\/.*shrink_200_200/,
  );
  assert.match(result.warning, /about|usually 5/);
});

test("LinkedIn profiles without posts are empty, while pages without profile data fail", () => {
  assert.deepEqual(
    parseLinkedInProfile(profilePage([]), "ada-example", "c").posts,
    [],
  );
  assert.throws(
    () => parseLinkedInProfile("<html>Sign in</html>", "ada-example", "c"),
    /did not return a public profile/,
  );
});

test("LinkedIn embeds give the best LinkedIn-hosted video, photos, articles and decoded text", () => {
  const video = parseLinkedInEmbed(embedPage(videoTag));
  assert.deepEqual(video.images, []);
  assert.equal(video.videos?.length, 1);
  assert.match(video.videos![0].url, /mp4-720p.*t=high$/);
  assert.match(video.videos![0].poster!, /videocover-high.*&v=beta&t=p$/);
  assert.equal(video.image, video.videos![0].poster);
  assert.equal(video.text, "Line & one\nLine two https://example.com");
  assert.equal(video.name, "Ada Example");
  assert.equal(video.authorSlug, "ada-example");
  assert.match(video.avatar!, /shrink_400_400.*&v=beta&t=b$/);

  const photos = parseLinkedInEmbed(embedPage(photoList));
  assert.equal(photos.images.length, 2);
  assert.ok(photos.images.every((src) => src.startsWith(`${CDN}/P`)));
  assert.equal(photos.image, photos.images[0]);
  assert.equal(photos.videos, undefined);

  const article = parseLinkedInEmbed(embedPage(articleCard));
  assert.deepEqual(article.images, [article.image]);
  assert.match(article.image!, /articleshare/);

  const textOnly = parseLinkedInEmbed(embedPage(""));
  assert.deepEqual(textOnly.images, []);
  assert.equal(textOnly.image, undefined);
});

function stubFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    return handler(String(input), init);
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}
const withUrl = (response: Response, url: string) =>
  Object.defineProperty(response, "url", { value: url });

test("LinkedIn sync fetches embeds only for new posts and keeps known media", async () => {
  const known: Post = {
    id: `linkedin:${ID2}`,
    creatorId: "c",
    title: "",
    url: "",
    kind: "post",
    published: "",
    read: true,
    saved: false,
    images: [`${CDN}/kept.jpg`],
    image: `${CDN}/kept.jpg`,
  };
  const stub = stubFetch((url, init) => {
    assert.equal((init?.headers as Record<string, string>)?.Cookie, undefined);
    if (url === "https://www.linkedin.com/in/ada-example/")
      return withUrl(
        new Response(profilePage([posting(ID1), posting(ID2)])),
        "https://www.linkedin.com/in/ada-example",
      );
    if (
      url ===
      `https://www.linkedin.com/embed/feed/update/urn:li:activity:${ID1}`
    )
      return new Response(embedPage(videoTag));
    throw new Error(`unexpected ${url}`);
  });
  try {
    const result = await syncLinkedIn(
      "https://www.linkedin.com/in/Ada-Example",
      "c",
      new Map([[known.id, known]]),
    );
    assert.deepEqual(stub.calls, [
      "https://www.linkedin.com/in/ada-example/",
      `https://www.linkedin.com/embed/feed/update/urn:li:activity:${ID1}`,
    ]);
    const fresh = result.posts.find((p) => p.id === `linkedin:${ID1}`)!;
    assert.match(fresh.videos![0].url, /mp4-720p/);
    assert.deepEqual(fresh.images, []);
    const kept = result.posts.find((p) => p.id === known.id)!;
    assert.deepEqual(kept.images, known.images);
    assert.equal(kept.image, known.image);
    assert.match(result.avatar!, /licdn/);
    assert.equal(result.name, "Ada Example");
  } finally {
    stub.restore();
  }
});

test("LinkedIn sync keeps posts when an embed fails so the next refresh retries media", async () => {
  const stub = stubFetch((url) =>
    url.includes("/embed/")
      ? new Response("Not found", { status: 404 })
      : new Response(profilePage([posting(ID1)])),
  );
  try {
    const result = await syncLinkedIn("ada-example", "c");
    assert.equal(result.posts.length, 1);
    assert.equal(result.posts[0].images, undefined);
  } finally {
    stub.restore();
  }
});

test("LinkedIn sync reports refusals and sign-in walls instead of an empty success", async () => {
  for (const [response, message] of [
    [
      // Node rejects status 999 in the constructor; LinkedIn really sends it.
      Object.defineProperties(new Response(""), {
        status: { value: 999 },
        ok: { value: false },
      }),
      /HTTP 999/,
    ],
    [new Response("", { status: 404 }), /not found/],
    [
      withUrl(
        new Response("<html>join</html>"),
        "https://www.linkedin.com/authwall?sessionRedirect=x",
      ),
      /sign-in/,
    ],
  ] as const) {
    const stub = stubFetch(() => response);
    try {
      await assert.rejects(syncLinkedIn("ada-example", "c"), message);
    } finally {
      stub.restore();
    }
  }
});

test("LinkedIn post links are cleaned, recognised and imported from the public embed", async () => {
  const pasted = `https://tr.linkedin.com/posts/ada-example_first-line-activity-${ID1}-cjjH?utm_source=share&rcm=abc`;
  assert.equal(
    cleanPastedUrl(pasted),
    `https://tr.linkedin.com/posts/ada-example_first-line-activity-${ID1}-cjjH`,
  );
  assert.deepEqual(contentUrl(pasted), {
    platform: "linkedin",
    id: ID1,
    url: `https://www.linkedin.com/posts/ada-example_first-line-activity-${ID1}-cjjH`,
  });
  assert.throws(() => contentUrl("https://www.linkedin.com/in/ada-example/"));
  const stub = stubFetch((url) => {
    assert.equal(
      url,
      `https://www.linkedin.com/embed/feed/update/urn:li:activity:${ID1}`,
    );
    return new Response(embedPage(photoList));
  });
  try {
    const { post, name } = await importLink(pasted);
    assert.equal(name, "Ada Example");
    assert.equal(post.id, `linkedin:${ID1}`);
    assert.equal(post.platform, "linkedin");
    assert.equal(post.sourceUsername, "ada-example");
    assert.equal(post.libraryOnly, true);
    assert.equal(post.title, "Line & one");
    assert.equal(post.images?.length, 2);
    assert.equal(post.published, "2026-08-12T09:47:25.912Z");
  } finally {
    stub.restore();
  }
});

test("LinkedIn profile names stay valid after lowercasing, so stored names re-validate", () => {
  for (const input of [
    "İlker-Demir",
    "https://www.linkedin.com/in/%C4%B0lker-Demir",
  ]) {
    const stored = linkedinUsername(input);
    assert.equal(linkedinUsername(stored), stored);
  }
  assert.equal(linkedinUsername("Café-ada"), linkedinUsername("Café-ada"));
});

test("LinkedIn embeds ignore images outside the post's photo list and link card", () => {
  const noPreview = parseLinkedInEmbed(
    embedPage(
      `<a class="feed-article-content" data-test-id="article-content" role="button"><span>Site</span></a>
       <div><img data-delayed-url="${CDN}/related/feedshare-shrink_800/0/1"></div>
       <img data-delayed-url="https://static.licdn.com/aero-v1/sc/h/like.svg">`,
    ),
  );
  assert.deepEqual(noPreview.images, []);
  assert.equal(noPreview.image, undefined);
  const staticIcon = parseLinkedInEmbed(
    embedPage(
      `<ul data-test-id="feed-images-content"><li><img data-delayed-url="https://static.licdn.com/aero-v1/sc/h/x.svg"></li></ul>`,
    ),
  );
  assert.deepEqual(staticIcon.images, []);
});

test("LinkedIn sync skips embeds for posts already outside retention", async () => {
  const stub = stubFetch((url) => {
    if (url.includes("/embed/")) throw new Error(`unexpected embed ${url}`);
    return new Response(profilePage([posting(ID1)]));
  });
  try {
    const result = await syncLinkedIn(
      "ada-example",
      "c",
      new Map(),
      Date.parse("2026-11-01T00:00:00Z"),
    );
    assert.equal(stub.calls.length, 1);
    assert.equal(result.posts[0].images, undefined);
  } finally {
    stub.restore();
  }
});

test("LinkedIn sync keeps a JSON-LD image visible in the viewer when the embed has no media", async () => {
  const image = `${CDN}/doc/feedshare-document-cover/0/1?e=2147483647&v=beta&t=d`;
  const stub = stubFetch((url) =>
    url.includes("/embed/")
      ? new Response(embedPage(""))
      : new Response(
          profilePage([
            posting(ID1, { image: { "@type": "ImageObject", url: image } }),
          ]),
        ),
  );
  try {
    const [post] = (await syncLinkedIn("ada-example", "c")).posts;
    assert.equal(post.image, image);
    assert.deepEqual(post.images, [image]);
  } finally {
    stub.restore();
  }
});

test("LinkedIn ugcPost links import under the activity id that profile sync uses", async () => {
  const ugc = "7493241730000000000";
  const stub = stubFetch((url) => {
    assert.equal(
      url,
      `https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:${ugc}`,
    );
    return new Response(embedPage(""));
  });
  try {
    const { post } = await importLink(
      `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ugc}/`,
    );
    assert.equal(post.id, `linkedin:${ID1}`);
    assert.equal(post.published, linkedinIdDate(ID1));
    assert.equal(
      post.url,
      `https://www.linkedin.com/feed/update/urn:li:ugcPost:${ugc}/`,
    );
  } finally {
    stub.restore();
  }
});
