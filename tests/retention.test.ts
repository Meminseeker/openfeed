import { test } from "node:test";
import assert from "node:assert/strict";
import { expiredPost, retentionDays } from "../server/retention.ts";
import type { Post } from "../src/types.ts";
const now = Date.parse("2026-10-27T12:00:00Z");
const post: Post = {
  id: "old",
  creatorId: "c",
  title: "Old",
  url: "https://example.com",
  kind: "post",
  published: "2025-01-01T00:00:00Z",
  read: false,
  saved: false,
};
test("retention preserves saved, annotated, recent, undated and invalid-date posts", () => {
  assert.equal(expiredPost(post, 90, now), true);
  for (const patch of [
    { saved: true },
    { notes: "Keep this" },
    { notes: "  useful note  " },
    { published: "" },
    { published: "invalid" },
    { published: "2026-10-27T00:00:00Z" },
  ])
    assert.equal(expiredPost({ ...post, ...patch }, 90, now), false);
  assert.equal(expiredPost({ ...post, notes: " \n " }, 90, now), true);
  assert.equal(
    expiredPost(
      { ...post, published: new Date(now - 90 * 86400000).toISOString() },
      90,
      now,
    ),
    false,
  );
});
test("unread Patreon posts are kept until read, then follow normal retention", () => {
  const patreon: Post = { ...post, platform: "patreon" };
  assert.equal(expiredPost(patreon, 7, now), false);
  assert.equal(expiredPost({ ...patreon, read: true }, 7, now), true);
  assert.equal(
    expiredPost({ ...patreon, read: true, saved: true }, 7, now),
    false,
  );
});
test("retention configuration rejects unsafe values", () => {
  assert.equal(retentionDays("90"), 90);
  for (const value of ["", "0", "-1", "NaN", "Infinity"])
    assert.throws(() => retentionDays(value));
});
