import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSwipe } from "../src/viewer-swipe.ts";
test("content swipes distinguish intentional navigation from taps and scrolling", () => {
  assert.equal(contentSwipe(-100, 10), 1);
  assert.equal(contentSwipe(100, 10), -1);
  assert.equal(contentSwipe(20, 5), 0);
  assert.equal(contentSwipe(100, 200), 0);
  assert.equal(contentSwipe(60, 0), 0);
  assert.equal(contentSwipe(-90, 60), 0);
});
