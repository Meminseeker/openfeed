import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentFilterKey,
  topicCreators,
  eligibleSelection,
} from "../src/feed-filters.ts";
import type { Creator, Post } from "../src/types.ts";
test("content filters distinguish the same content kind on different platforms and preserve legacy YouTube", () => {
  assert.equal(
    contentFilterKey({ kind: "post", platform: "x" } as Post),
    "x:post",
  );
  assert.equal(
    contentFilterKey({ kind: "post", platform: "instagram" } as Post),
    "instagram:post",
  );
  assert.equal(contentFilterKey({ kind: "video" } as Post), "youtube:video");
  assert.equal(
    contentFilterKey({ kind: "short", platform: "instagram" } as Post),
    "instagram:short",
  );
});
test("topic creator list and multiple selection discard unavailable creators after a topic change", () => {
  const creators = [
    { id: "a", tags: ["Long Form"] },
    { id: "b", tags: ["Long Form", "News"] },
    { id: "c", tags: ["News"] },
  ] as Creator[];
  assert.deepEqual(
    topicCreators(creators, "Long Form").map((c) => c.id),
    ["a", "b"],
  );
  assert.deepEqual(
    eligibleSelection(["a", "b", "c"], topicCreators(creators, "Long Form")),
    ["a", "b"],
  );
  assert.deepEqual(
    eligibleSelection(["a", "b"], topicCreators(creators, "News")),
    ["b"],
  );
  assert.equal(topicCreators(creators, "All topics").length, 3);
});

test("all creators are checked by default and an empty explicit selection means none", async () => {
  const { selectedCreators, inTimeRange } =
    await import("../src/feed-filters.ts");
  const creators = [{ id: "a" }, { id: "b" }] as Creator[];
  assert.deepEqual(selectedCreators(null, creators), ["a", "b"]);
  assert.deepEqual(selectedCreators(["b"], creators), ["b"]);
  assert.deepEqual(selectedCreators([], creators), []);
  const now = Date.parse("2026-10-28T12:00:00Z");
  const post = { published: "2026-10-26T12:00:00Z" } as Post;
  assert.equal(inTimeRange(post, "1d", now), false);
  assert.equal(inTimeRange(post, "2d", now), true);
  assert.equal(inTimeRange(post, "1w+", now), false);
  assert.equal(
    inTimeRange({ published: "2026-10-20T12:00:00Z" } as Post, "1w+", now),
    true,
  );
  assert.equal(inTimeRange({ published: "" } as Post, "1w", now), false);
  assert.equal(inTimeRange({ published: "" } as Post, "All", now), true);
});
test("platform labels distinguish Reels, Shorts and reposts; X defaults exclude reposts", async () => {
  const { postLabel } = await import("../src/post-label.ts");
  const { enabledTypes } = await import("../src/types.ts");
  assert.equal(
    postLabel({ platform: "instagram", kind: "short" } as Post),
    "Instagram Reel",
  );
  assert.equal(postLabel({ kind: "short" } as Post), "YouTube Shorts");
  assert.equal(
    postLabel({ platform: "x", kind: "post", repost: true } as Post),
    "X Repost",
  );
  assert.deepEqual(enabledTypes({ platform: "x", username: "test" }), ["post"]);
  assert.deepEqual(
    enabledTypes({ platform: "x", username: "test", syncTypes: ["repost"] }),
    ["repost"],
  );
});

test("type counts share feed filters but ignore type toggles; include saved library items", async () => {
  const { matchesFeedFilters } = await import("../src/feed-filters.ts");
  const creators = [
    { id: "a", name: "Alice", tags: ["News"], accounts: [], avatar: "" },
    {
      id: "b",
      name: "Bob",
      tags: [],
      accounts: [],
      avatar: "",
      libraryOnly: true,
    },
  ];
  const p = {
    id: "p",
    creatorId: "a",
    title: "A useful post",
    url: "https://x.com/test/status/123",
    platform: "x" as const,
    kind: "post" as const,
    published: new Date().toISOString(),
    read: false,
    saved: true,
  };
  const filters = {
    page: "feed",
    tag: "News",
    query: "useful",
    types: ["youtube:video"],
    selection: ["a"],
    timeRange: "1d" as const,
    unread: false,
    allCreators: true,
  };
  assert.equal(matchesFeedFilters(p, creators, filters), false);
  assert.equal(matchesFeedFilters(p, creators, filters, true), true);
  assert.equal(
    matchesFeedFilters(
      p,
      creators,
      { ...filters, selection: [], allCreators: false },
      true,
    ),
    false,
  );
  assert.equal(
    matchesFeedFilters(p, creators, { ...filters, query: "missing" }, true),
    false,
  );
  assert.equal(
    matchesFeedFilters(
      { ...p, creatorId: "b", libraryOnly: true },
      creators,
      { ...filters, tag: "All topics" },
      true,
    ),
    false,
  );
  assert.equal(
    matchesFeedFilters(
      { ...p, creatorId: "b", libraryOnly: true },
      creators,
      { ...filters, page: "saved", tag: "All topics" },
      true,
    ),
    true,
  );
});
