import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeTime } from "../src/relative-time.ts";
test("elapsed labels handle minutes, hours, days, invalid and future dates", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  for (const [seconds, expected] of [
    [5, "just now"],
    [300, "5m ago"],
    [7200, "2h ago"],
    [259200, "3d ago"],
    [-3600, "just now"],
  ] as const)
    assert.equal(
      relativeTime(new Date(now - seconds * 1000).toISOString(), now),
      expected,
    );
  assert.equal(relativeTime("", now), "Date unavailable");
});
