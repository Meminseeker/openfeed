import { test } from "node:test";
import assert from "node:assert/strict";
import { sortContents } from "../src/ContentOptions.tsx";
import { matchesFeedFilters } from "../src/feed-filters.ts";
import { hourlyRefresh } from "../server/refresh.ts";
import type { Post, Creator } from "../src/types.ts";
test("content sorting uses publication dates, but links use addition dates", () => {
  const posts = [
    { id: "a", published: "2026-01-01", linkedAt: "2026-02-02" },
    { id: "b", published: "2026-01-02", linkedAt: "2026-02-01" },
  ] as Post[];
  assert.deepEqual(
    sortContents(posts, "newest").map((p) => p.id),
    ["b", "a"],
  );
  assert.deepEqual(
    sortContents(posts, "oldest").map((p) => p.id),
    ["a", "b"],
  );
  assert.deepEqual(
    sortContents(posts, "newest", true).map((p) => p.id),
    ["a", "b"],
  );
  assert.deepEqual(
    sortContents(posts, "oldest", true).map((p) => p.id),
    ["b", "a"],
  );
  assert.equal(posts[0].id, "a");
});
test("read status composes with feed, saved and noted scopes", () => {
  const creators = [
    { id: "a", name: "Alice", tags: [] },
  ] as unknown as Creator[];
  const post = {
    creatorId: "a",
    title: "Post",
    read: true,
    saved: true,
    notes: "note",
  } as Post;
  for (const page of ["feed", "saved", "noted"]) {
    const filters = {
      page,
      tag: "All topics",
      query: "",
      types: [],
      selection: ["a"],
      timeRange: "All" as const,
      unread: false,
      allCreators: true,
    };
    assert.equal(
      matchesFeedFilters(post, creators, { ...filters, readStatus: "read" }),
      true,
    );
    assert.equal(
      matchesFeedFilters(post, creators, { ...filters, readStatus: "unread" }),
      false,
    );
    assert.equal(
      matchesFeedFilters({ ...post, read: false }, creators, {
        ...filters,
        readStatus: "read",
      }),
      false,
    );
    assert.equal(
      matchesFeedFilters(post, creators, { ...filters, readStatus: "all" }),
      true,
    );
  }
});
test("hourly refresh serializes accounts, skips overlap and recovers from failure", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const calls: string[] = [],
    errors: unknown[] = [];
  const run = hourlyRefresh(
    () => ["a", "b"],
    async (id) => {
      calls.push(id);
      if (id === "a") {
        await gate;
        throw Error("failed");
      }
    },
    (e) => errors.push(e),
  );
  const first = run();
  await run();
  assert.deepEqual(calls, ["a"]);
  release();
  await first;
  assert.deepEqual(calls, ["a", "b"]);
  assert.equal(errors.length, 1);
  await run();
  assert.deepEqual(calls, ["a", "b", "a", "b"]);
});
