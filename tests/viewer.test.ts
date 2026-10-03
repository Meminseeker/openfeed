import { test } from "node:test";
import assert from "node:assert/strict";
import {
  viewerShortcut,
  seekPosition,
  timestamp,
  noteTimestamps,
} from "../src/viewer-shortcuts";
test("viewer shortcuts protect note typing and browser shortcuts", () => {
  assert.equal(viewerShortcut("ArrowDown", false, false), "next");
  assert.equal(viewerShortcut("ArrowUp", false, false), "previous");
  assert.equal(viewerShortcut("ArrowLeft", false, false), "back");
  assert.equal(viewerShortcut("c", false, false), "captions");
  assert.equal(viewerShortcut(" ", false, false), "play");
  for (const key of [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "c",
    " ",
    "Escape",
  ])
    assert.equal(viewerShortcut(key, true, false), undefined);
  assert.equal(viewerShortcut("c", false, true), undefined);
});
test("video seeking clamps boundaries; timestamp notes round-trip", () => {
  assert.equal(seekPosition(2, -5, 120), 0);
  assert.equal(seekPosition(118, 5, 120), 120);
  assert.equal(seekPosition(10, 5, 0), 15);
  assert.equal(timestamp(61.9), "1:01");
  assert.equal(timestamp(3661), "1:01:01");
  assert.deepEqual(
    noteTimestamps("[1:01] idea\n[1:01:01] later\n[1:01] duplicate"),
    [
      { label: "[1:01]", seconds: 61 },
      { label: "[1:01:01]", seconds: 3661 },
    ],
  );
});
