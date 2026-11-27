import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  hkdfSync,
  randomBytes,
  verify,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  buildVapidHeader,
  encryptPushPayload,
  generateVapidKeys,
  hasPushSubscription,
  initializePushTables,
  listPushSubscriptions,
  loadOrCreateVapidKeys,
  removePushSubscription,
  savePushSubscription,
  sendUserNotification,
} from "../server/push.ts";
import { buildRefreshNotification } from "../server/notifications.ts";
import type { Creator, Post } from "../src/types.ts";

function makeClientKeys() {
  const ecdh = createECDH("prime256v1");
  const publicKey = ecdh.generateKeys();
  const auth = randomBytes(16);
  return {
    ecdh,
    p256dh: publicKey.toString("base64url"),
    auth: auth.toString("base64url"),
    publicKey,
    authBuffer: auth,
  };
}

// Reference RFC 8291 (aes128gcm) decryption to verify our encryption output.
function decryptAes128Gcm(
  encrypted: Buffer,
  uaEcdh: ReturnType<typeof createECDH>,
  uaPublic: Buffer,
  authSecret: Buffer,
): string {
  const salt = encrypted.subarray(0, 16);
  const rs = encrypted.readUInt32BE(16);
  assert.equal(rs, 4096);
  const idLen = encrypted.readUInt8(20);
  assert.equal(idLen, 65);
  const asPublic = encrypted.subarray(21, 21 + idLen);
  const body = encrypted.subarray(21 + idLen);
  const ciphertext = body.subarray(0, body.length - 16);
  const authTag = body.subarray(body.length - 16);

  const ecdhSecret = uaEcdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    uaPublic,
    asPublic,
  ]);
  const ikm = Buffer.from(
    hkdfSync("sha256", ecdhSecret, authSecret, keyInfo, 32),
  );
  const cek = Buffer.from(
    hkdfSync(
      "sha256",
      ikm,
      salt,
      Buffer.from("Content-Encoding: aes128gcm\0", "utf8"),
      16,
    ),
  );
  const nonce = Buffer.from(
    hkdfSync(
      "sha256",
      ikm,
      salt,
      Buffer.from("Content-Encoding: nonce\0", "utf8"),
      12,
    ),
  );
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  assert.equal(decrypted[decrypted.length - 1], 0x02);
  return decrypted.subarray(0, decrypted.length - 1).toString("utf8");
}

test("RFC 8291 aes128gcm payload encrypts and decrypts cleanly", () => {
  const client = makeClientKeys();
  const payload = JSON.stringify({
    kind: "feed-refresh",
    title: "2 new posts in OpenFeed",
    body: "Tech (2): Alice, Bob",
  });
  const encrypted = encryptPushPayload(payload, client.p256dh, client.auth);
  const decrypted = decryptAes128Gcm(
    encrypted,
    client.ecdh,
    client.publicKey,
    client.authBuffer,
  );
  assert.equal(decrypted, payload);
});

test("VAPID JWT uses ES256 IEEE P1363 signature verifiable by its public key", () => {
  const keys = generateVapidKeys("https://openfeed.meminseeker.com");
  const header = buildVapidHeader(
    "https://fcm.googleapis.com/fcm/send/abc123",
    keys,
    1700000000,
  );
  const match = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(match);
  const [, jwt, pub] = match;
  assert.equal(pub, keys.publicKey);
  const [h, p, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), {
    typ: "JWT",
    alg: "ES256",
  });
  assert.deepEqual(JSON.parse(Buffer.from(p, "base64url").toString()), {
    aud: "https://fcm.googleapis.com",
    exp: 1700000000 + 12 * 3600,
    sub: "https://openfeed.meminseeker.com",
  });
  const rawPub = Buffer.from(pub, "base64url");
  const keyObj = createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: rawPub.subarray(1, 33).toString("base64url"),
      y: rawPub.subarray(33, 65).toString("base64url"),
    },
    format: "jwk",
  });
  const ok = verify(
    "sha256",
    Buffer.from(`${h}.${p}`),
    { key: keyObj, dsaEncoding: "ieee-p1363" },
    Buffer.from(s, "base64url"),
  );
  assert.equal(ok, true);
});

test("VAPID keys persist in SQLite and subscriptions isolate accounts and prune 410s", async () => {
  const db = new DatabaseSync(":memory:");
  initializePushTables(db);

  const first = loadOrCreateVapidKeys(db, "https://openfeed.meminseeker.com");
  const second = loadOrCreateVapidKeys(db, "https://openfeed.meminseeker.com");
  assert.equal(first.publicKey, second.publicKey);
  assert.equal(first.privateKey, second.privateKey);

  const c1 = makeClientKeys();
  const c2 = makeClientKeys();
  const endpoint1 = "https://web.push.apple.com/sub-1";
  const endpoint2 = "https://fcm.googleapis.com/fcm/send/sub-2";

  // Reject non-HTTPS endpoint.
  assert.throws(() =>
    savePushSubscription(db, "u1", {
      endpoint: "http://example.com/push",
      p256dh: c1.p256dh,
      auth: c1.auth,
      locale: "en",
    }),
  );

  savePushSubscription(db, "u1", {
    endpoint: endpoint1,
    p256dh: c1.p256dh,
    auth: c1.auth,
    locale: "tr",
  });
  assert.equal(hasPushSubscription(db, "u1", endpoint1), true);

  // Subscribing the same browser endpoint on another account reassigns it.
  savePushSubscription(db, "u2", {
    endpoint: endpoint1,
    p256dh: c1.p256dh,
    auth: c1.auth,
    locale: "en",
  });
  assert.equal(hasPushSubscription(db, "u1", endpoint1), false);
  assert.equal(hasPushSubscription(db, "u2", endpoint1), true);

  savePushSubscription(db, "u2", {
    endpoint: endpoint2,
    p256dh: c2.p256dh,
    auth: c2.auth,
    locale: "tr",
  });

  const sentRequests: { url: string; headers: HeadersInit }[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    sentRequests.push({ url, headers: init?.headers || {} });
    if (url === endpoint1) return new Response(null, { status: 410 });
    return new Response(null, { status: 201 });
  };

  const result = await sendUserNotification(
    db,
    "u2",
    first,
    (locale) => ({
      kind: "feed-refresh",
      title: locale === "tr" ? "Yeni içerik" : "New content",
      body: "Summary",
      tag: "openfeed-refresh",
      url: "/",
    }),
    { fetchImpl: fakeFetch },
  );

  assert.deepEqual(result, { sent: 1, failed: 0, pruned: 1 });
  assert.equal(sentRequests.length, 2);
  assert.equal(listPushSubscriptions(db, "u2").length, 1);
  assert.equal(hasPushSubscription(db, "u2", endpoint1), false);
  assert.equal(hasPushSubscription(db, "u2", endpoint2), true);

  removePushSubscription(db, "u2", endpoint2);
  assert.equal(listPushSubscriptions(db, "u2").length, 0);
});

function creator(
  id: string,
  name: string,
  tags: string[] = [],
  notificationsMuted = false,
): Creator {
  return {
    id,
    name,
    tags,
    accounts: [],
    avatar: "",
    notificationsMuted,
  };
}

function post(id: string, creatorId: string, title: string): Post {
  return {
    id,
    creatorId,
    title,
    url: `https://example.com/${id}`,
    kind: "video",
    published: "2026-11-27T00:00:00Z",
    read: false,
    saved: false,
  };
}

test("buildRefreshNotification groups by topic, respects muted creators, and localizes", () => {
  const alice = creator("c1", "Alice", ["Tech"]);
  const bob = creator("c2", "Bob", ["Tech", "AI"]);
  const carol = creator("c3", "Carol", ["Design"]);
  const muted = creator("c4", "Muted", ["Tech"], true);

  // All muted -> null
  assert.equal(
    buildRefreshNotification([{ post: post("p0", "c4", "Skip"), creator: muted }]),
    null,
  );

  // Single post with topic
  const single = buildRefreshNotification(
    [{ post: post("p1", "c1", "New Rust release"), creator: alice }],
    "en",
  );
  assert.ok(single);
  assert.equal(single.title, "Tech · Alice");
  assert.equal(single.body, "New Rust release");
  assert.equal(single.tag, "openfeed-refresh");
  assert.equal(single.url, "/?topic=Tech");

  // Multiple posts across topics (muted creator excluded)
  const multiEn = buildRefreshNotification(
    [
      { post: post("p1", "c1", "One"), creator: alice },
      { post: post("p2", "c2", "Two"), creator: bob },
      { post: post("p3", "c3", "Three"), creator: carol },
      { post: post("p4", "c4", "Muted post"), creator: muted },
    ],
    "en",
  );
  assert.ok(multiEn);
  assert.equal(multiEn.title, "3 new posts in OpenFeed");
  assert.equal(multiEn.body, "Tech (2): Alice, Bob · Design (1): Carol");
  assert.equal(multiEn.url, "/");

  // Turkish localization + single shared topic deep-link
  const multiTr = buildRefreshNotification(
    [
      { post: post("p1", "c1", "One"), creator: alice },
      { post: post("p2", "c2", "Two"), creator: bob },
    ],
    "tr",
  );
  assert.ok(multiTr);
  assert.equal(multiTr.title, "OpenFeed'de 2 yeni içerik");
  assert.equal(multiTr.body, "Tech (2): Alice, Bob");
  assert.equal(multiTr.url, "/?topic=Tech");

  // Creators without topics fall back to listing creator names
  const untagged = creator("c5", "Dave", []);
  const untagged2 = creator("c6", "Eve", []);
  const noTopics = buildRefreshNotification(
    [
      { post: post("p5", "c5", "A"), creator: untagged },
      { post: post("p6", "c6", "B"), creator: untagged2 },
    ],
    "en",
  );
  assert.ok(noTopics);
  assert.equal(noTopics.title, "2 new posts in OpenFeed");
  assert.equal(noTopics.body, "Dave, Eve");
  assert.equal(noTopics.url, "/");
});
