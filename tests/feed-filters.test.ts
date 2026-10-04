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
