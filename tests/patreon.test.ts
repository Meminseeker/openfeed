import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchPatreonPost,
  patreonDoc,
  patreonPost,
  patreonUsername,
  resolvePatreonCampaign,
  syncPatreon,
} from "../server/patreon.ts";
import type { Post } from "../src/types.ts";

const media =
  "https://c10.patreonusercontent.com/4/patreon-media/p/post/1/a.png";
const doc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Market" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Plain " },
        {
          type: "text",
          text: "bold",
          marks: [{ type: "bold" }, { type: "underline" }],
        },
        { type: "hardBreak" },
        {
          type: "text",
          text: "link",
          marks: [{ type: "link", attrs: { href: "https://example.com/a" } }],
        },
        {
          type: "text",
          text: " bad",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    },
    {
      type: "image",
      attrs: { src: media, media_width: 1600, media_height: 900 },
    },
    { type: "image", attrs: { src: "https://evil.example/x.png" } },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "One", marks: [{ type: "italic" }] },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "First" }] },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Quote" }] },
      ],
    },
    { type: "horizontalRule" },
    { type: "paragraph", content: [] },
    { type: "mystery", content: [{ type: "text", text: "Fallback" }] },
  ],
};
const item = (id: string, published: string, patch: any = {}) => ({
  id,
  type: "post",
  attributes: {
    title: `Post ${id}`,
    content_json_string: JSON.stringify(doc),
    teaser_text_json_string: JSON.stringify({ type: "doc", content: [] }),
    published_at: published,
    url: `https://www.patreon.com/posts/post-${id}`,
    current_user_can_view: true,
    was_posted_by_campaign_owner: true,
    image: { url: media, large_url: media },
    embed: null,
    ...patch,
  },
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/vnd.api+json" },
  });

test("Patreon usernames accept creator URLs and reject foreign, post and reserved paths", () => {
  assert.equal(patreonUsername("yatirim101"), "yatirim101");
  assert.equal(patreonUsername("@Yatirim101"), "yatirim101");
  assert.equal(
    patreonUsername("https://www.patreon.com/cw/yatirim101"),
    "yatirim101",
  );
  assert.equal(
    patreonUsername("https://patreon.com/c/Yatirim101/"),
    "yatirim101",
  );
  for (const input of [
    "https://evil.com/yatirim101",
    "http://www.patreon.com/yatirim101",
    "https://user@www.patreon.com/yatirim101",
    "https://www.patreon.com:444/yatirim101",
    "https://www.patreon.com/posts/abc-123",
    "https://www.patreon.com/yatirim101/posts",
    "home",
    "bad/name",
    "",
  ])
    assert.throws(() => patreonUsername(input));
});

test("Patreon documents become sanitized blocks with plain-text fallback", () => {
  const { blocks, text } = patreonDoc(JSON.stringify(doc));
  assert.deepEqual(blocks, [
    { type: "heading", level: 2, spans: [{ text: "Market" }] },
    {
      type: "paragraph",
      spans: [
        { text: "Plain " },
        { text: "bold\n", bold: true, underline: true },
        { text: "link", href: "https://example.com/a" },
        { text: " bad" },
      ],
    },
    { type: "image", src: media, width: 1600, height: 900 },
    { type: "item", ordered: false, spans: [{ text: "One", italic: true }] },
    { type: "item", ordered: true, spans: [{ text: "First" }] },
    { type: "quote", spans: [{ text: "Quote" }] },
    { type: "rule" },
    { type: "paragraph", spans: [{ text: "Fallback" }] },
  ]);
  assert.equal(
    text,
    "Market\n\nPlain bold\nlink bad\n\n• One\n\n• First\n\nQuote\n\nFallback",
  );
  assert.deepEqual(patreonDoc("not json"), { blocks: [], text: "" });
});

test("Patreon posts map unlocked, locked and YouTube-embed posts and skip non-owner posts", () => {
  const post = patreonPost(
    item("10", "2026-10-30T20:11:14.000+00:00"),
    "yatirim101",
    "c",
  )!;
  assert.equal(post.id, "patreon:10");
  assert.equal(post.platform, "patreon");
  assert.equal(post.kind, "post");
  assert.equal(post.published, "2026-10-30T20:11:14.000Z");
  assert.equal(post.image, media);
  assert.equal(post.blocks?.length, 8);
  assert.equal(post.locked, undefined);
  const locked = patreonPost(
    item("11", "2026-10-30T20:00:00Z", {
      current_user_can_view: false,
      content_json_string: null,
      teaser_text_json_string: JSON.stringify({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Teaser" }] },
        ],
      }),
    }),
    "yatirim101",
    "c",
  )!;
  assert.equal(locked.locked, true);
  assert.equal(locked.blocks, undefined);
  assert.equal(locked.text, "Teaser");
  const video = patreonPost(
    item("12", "2026-10-30T20:00:00Z", {
      embed: { url: "https://www.youtube.com/watch?v=oyGU7CTXX5E" },
    }),
    "yatirim101",
    "c",
  )!;
  assert.equal(video.videoId, "oyGU7CTXX5E");
  assert.equal(
    patreonPost(
      item("13", "2026-10-30T20:00:00Z", {
        was_posted_by_campaign_owner: false,
      }),
      "y",
      "c",
    ),
    undefined,
  );
  const foreign = patreonPost(
    item("14", "2026-10-30T20:00:00Z", {
      url: "https://evil.example/posts/14",
      image: { url: "https://evil.example/a.png" },
    }),
    "y",
    "c",
  )!;
  assert.equal(foreign.url, "https://www.patreon.com/posts/14");
  assert.equal(foreign.image, undefined);
});

test("Patreon campaign lookup requires an exact vanity match", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  try {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      urls.push(url);
      assert.equal((init.headers as Record<string, string>).Cookie, undefined);
      return json({
        data: [
          {
            id: "6460488",
            type: "campaign",
            attributes: {
              vanity: "yatirim101",
              name: "Yatırım 101",
              avatar_photo_url: media,
            },
          },
        ],
      });
    }) as typeof fetch;
    assert.deepEqual(
      await resolvePatreonCampaign("https://www.patreon.com/cw/yatirim101"),
      {
        id: "6460488",
        name: "Yatırım 101",
        avatar: media,
      },
    );
    assert.match(urls[0], /filter%5Bvanity%5D=yatirim101/);
    await assert.rejects(resolvePatreonCampaign("someoneelse"), /not found/);
  } finally {
    globalThis.fetch = original;
  }
});

test("Patreon sync sends the session only when allowed, pages until the retention window and reports locked sessions", async () => {
  const original = globalThis.fetch;
  const previous = process.env.PATREON_SESSION_ID;
  const cookies: (string | undefined)[] = [];
  const urls: string[] = [];
  const since = Date.parse("2026-10-24T00:00:00Z");
  let canView = true;
  try {
    process.env.PATREON_SESSION_ID = "secret-session";
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      urls.push(url);
      assert.equal(init.redirect, "error");
      cookies.push((init.headers as Record<string, string>).Cookie);
      const page = new URL(url).searchParams.get("page[cursor]");
      return page
        ? json({
            data: [
              item("3", "2026-10-25T00:00:00Z", {
                current_user_can_view: canView,
              }),
              item("2", "2026-10-20T00:00:00Z"),
              item("1", "2026-10-19T00:00:00Z"),
            ],
            links: {
              next: "https://www.patreon.com/api/posts?page%5Bcursor%5D=c2",
            },
          })
        : json({
            data: [
              item("4", "2026-10-30T00:00:00Z", {
                current_user_can_view: canView,
              }),
            ],
            links: {
              next: "https://www.patreon.com/api/posts?page%5Bcursor%5D=c1",
            },
          });
    }) as typeof fetch;
    const owner = await syncPatreon("yatirim101", "6460488", "c", {
      useSession: true,
      since,
    });
    assert.deepEqual(
      owner.posts.map((p) => p.id),
      ["patreon:4", "patreon:3"],
    );
    assert.equal(owner.warning, undefined);
    assert.deepEqual(cookies, [
      "session_id=secret-session",
      "session_id=secret-session",
    ]);
    assert.equal(urls.length, 2);
    assert.match(urls[0], /filter%5Bcampaign_id%5D=6460488/);

    cookies.length = 0;
    const visitor = await syncPatreon("yatirim101", "6460488", "c", {
      useSession: false,
      since,
    });
    assert.deepEqual(cookies, [undefined, undefined]);
    assert.match(visitor.warning!, /public Patreon previews/);

    canView = false;
    const expired = await syncPatreon("yatirim101", "6460488", "c", {
      useSession: true,
      since,
    });
    assert.ok(expired.posts.every((p) => p.locked));
    assert.match(expired.warning!, /session expired/);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.PATREON_SESSION_ID;
    else process.env.PATREON_SESSION_ID = previous;
  }
});

test("Patreon sync stops at the page cap, ignores foreign next links and rejects blocks", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls++;
      return json({
        data: [item(String(1000 - calls), "2026-10-30T00:00:00Z")],
        links: {
          next: `https://www.patreon.com/api/posts?page%5Bcursor%5D=${calls}`,
        },
      });
    }) as typeof fetch;
    const capped = await syncPatreon("y", "1", "c", {
      useSession: false,
      since: 0,
    });
    assert.equal(calls, 10);
    assert.match(capped.warning!, /newest 200/);

    calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return json({
        data: [],
        links: { next: "https://evil.example/api/posts" },
      });
    }) as typeof fetch;
    await syncPatreon("y", "1", "c", { useSession: false, since: 0 });
    assert.equal(calls, 1);

    globalThis.fetch = (async () =>
      new Response("<html>Just a moment...</html>", {
        status: 403,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    await assert.rejects(
      syncPatreon("y", "1", "c", { useSession: false, since: 0 }),
      /blocked or unavailable \(HTTP 403\)/,
    );
    globalThis.fetch = (async () =>
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      })) as typeof fetch;
    await assert.rejects(
      syncPatreon("y", "1", "c", { useSession: false, since: 0 }),
      /blocked/,
    );
    await assert.rejects(
      syncPatreon("y", "abc", "c", { useSession: false, since: 0 }),
      /campaign/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("Patreon post detail renews content and signed images for the exact post", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  try {
    globalThis.fetch = (async (url: string) => {
      urls.push(url);
      return json({
        data: item("77", "2026-10-30T00:00:00Z", {
          image: { url: `${media}?token-time=2` },
        }),
      });
    }) as typeof fetch;
    const stored: Post = {
      id: "patreon:77",
      creatorId: "c",
      title: "Old",
      url: "https://www.patreon.com/posts/post-77",
      kind: "post",
      platform: "patreon",
      sourceUsername: "yatirim101",
      published: "2026-10-30T00:00:00Z",
      image: `${media}?token-time=1`,
      read: true,
      saved: true,
      notes: "keep",
    };
    const fresh = await fetchPatreonPost(stored, false);
    assert.equal(fresh.image, `${media}?token-time=2`);
    assert.equal(fresh.title, "Post 77");
    assert.equal(fresh.blocks?.length, 8);
    assert.equal(fresh.read, true);
    assert.equal(fresh.notes, "keep");
    assert.match(urls[0], /^https:\/\/www\.patreon\.com\/api\/posts\/77\?/);
    await fetchPatreonPost(stored, false);
    assert.equal(urls.length, 1, "detail is cached for five minutes");
    const x = { ...stored, id: "x:1", platform: "x" as const };
    assert.equal(await fetchPatreonPost(x, false), x);
  } finally {
    globalThis.fetch = original;
  }
});
