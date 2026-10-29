import { test } from "node:test";
import assert from "node:assert/strict";
import { writeNotes } from "../src/api";
test("note writes are serialized so a late old save cannot overwrite a newer edit or clear", async () => {
  const original = globalThis.fetch,
    seen: string[] = [];
  let release: () => void = () => {};
  globalThis.fetch = async (_input, init) => {
    const notes = JSON.parse(String(init?.body)).notes;
    seen.push(notes);
    if (notes === "old")
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return new Response(JSON.stringify({ notes }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const a = writeNotes("test", "old"),
      b = writeNotes("test", "new"),
      c = writeNotes("test", "");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, ["old"]);
    release();
    await Promise.all([a, b, c]);
    assert.deepEqual(seen, ["old", "new", ""]);
  } finally {
    globalThis.fetch = original;
  }
});
test("a failed note save does not block subsequent retries", async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => {
    count++;
    return count === 1
      ? new Response('{"error":"offline"}', { status: 503 })
      : new Response('{"notes":"retry"}');
  };
  try {
    await assert.rejects(writeNotes("retry", "first"), /offline/);
    await writeNotes("retry", "retry");
    assert.equal(count, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("queued and unmount note saves keep their original account after an account switch", async () => {
  const { setActiveAccount } = await import("../src/api");
  const original = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = async (_input, init) => {
    seen.push((init?.headers as Record<string, string>)["X-OpenFeed-User"]);
    return Response.json({});
  };
  try {
    setActiveAccount("alice");
    const write = writeNotes("shared", "Alice draft");
    setActiveAccount("bob");
    await write;
    await writeNotes("shared", "unmount draft", "alice");
    await writeNotes("shared", "Bob draft");
    assert.deepEqual(seen, ["alice", "alice", "bob"]);
  } finally {
    setActiveAccount("");
    globalThis.fetch = original;
  }
});
