import { test } from "node:test";
import assert from "node:assert/strict";
import { requestAllowed, validatePublicOrigin } from "../server/access.ts";

test("local mode allows loopback and rejects foreign hosts and origins", () => {
  assert.ok(requestAllowed("localhost:3000", "http://localhost:3000"));
  assert.ok(requestAllowed("[::1]:3000", undefined));
  assert.equal(requestAllowed("evil.example", undefined), false);
  assert.equal(requestAllowed("localhost:3000", "https://evil.example"), false);
});
test("cloud mode permits only the configured host and HTTPS origin", () => {
  const origin = "https://openfeed.meminseeker.com";
  assert.ok(requestAllowed("openfeed.meminseeker.com", origin, origin));
  assert.ok(requestAllowed("openfeed.meminseeker.com", undefined, origin));
  assert.equal(requestAllowed("localhost:3000", undefined, origin), false);
  assert.equal(
    requestAllowed(
      "openfeed.meminseeker.com",
      "http://openfeed.meminseeker.com",
      origin,
    ),
    false,
  );
  assert.equal(
    requestAllowed("openfeed.meminseeker.com", "https://evil.example", origin),
    false,
  );
});
test("public origin configuration fails closed", () => {
  assert.equal(
    validatePublicOrigin("https://openfeed.meminseeker.com/"),
    "https://openfeed.meminseeker.com",
  );
  for (const value of [
    "http://example.com",
    "https://example.com/path",
    "https://user:pass@example.com",
    "https://example.com?q=1",
  ])
    assert.throws(() => validatePublicOrigin(value));
});
