import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
}

// Generic push notification payload. Future notification producers (e.g. AI
// summaries) reuse this contract with their own `kind` and `tag`.
export interface PushMessage {
  kind: string;
  title: string;
  body: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

export interface SendPushOptions {
  ttl?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  topic?: string;
  fetchImpl?: typeof fetch;
}

const VAPID_SETTING_KEY = "vapid_keys";
const MAX_PAYLOAD_BYTES = 3993;
const AES128GCM_RECORD_SIZE = 4096;

export function initializePushTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      created INTEGER NOT NULL,
      PRIMARY KEY (user_id, endpoint)
    );
  `);
}

// Generates a P-256 ECDSA key pair in the raw base64url format expected by
// Web Push (65-byte uncompressed public key, 32-byte private scalar).
export function generateVapidKeys(subject = "mailto:openfeed@localhost"): VapidKeys {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const pubJwk = publicKey.export({ format: "jwk" });
  const privJwk = privateKey.export({ format: "jwk" });
  const x = Buffer.from(pubJwk.x!, "base64url");
  const y = Buffer.from(pubJwk.y!, "base64url");
  const rawPublic = Buffer.concat([Buffer.from([0x04]), x, y]);
  return {
    publicKey: rawPublic.toString("base64url"),
    privateKey: privJwk.d!,
    subject,
  };
}

function defaultVapidSubject(publicOrigin?: string) {
  if (process.env.VAPID_SUBJECT?.trim()) return process.env.VAPID_SUBJECT.trim();
  if (publicOrigin) return publicOrigin;
  return "mailto:openfeed@localhost";
}

export function loadOrCreateVapidKeys(
  db: DatabaseSync,
  publicOrigin?: string,
): VapidKeys {
  const subject = defaultVapidSubject(publicOrigin);
  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) {
    return { publicKey: envPublic, privateKey: envPrivate, subject };
  }
  const existing = db
    .prepare("SELECT value FROM app_settings WHERE key=?")
    .get(VAPID_SETTING_KEY) as { value: string } | undefined;
  if (existing) {
    const parsed = JSON.parse(existing.value) as {
      publicKey: string;
      privateKey: string;
    };
    if (parsed.publicKey && parsed.privateKey) {
      return {
        publicKey: parsed.publicKey,
        privateKey: parsed.privateKey,
        subject,
      };
    }
  }
  const created = generateVapidKeys(subject);
  db.prepare("INSERT OR REPLACE INTO app_settings VALUES (?,?)").run(
    VAPID_SETTING_KEY,
    JSON.stringify({
      publicKey: created.publicKey,
      privateKey: created.privateKey,
    }),
  );
  return created;
}

export function validatePushEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new Error("Push endpoint must use HTTPS.");
  }
  if (endpoint.length > 2048) {
    throw new Error("Push endpoint is too long.");
  }
  return url.toString();
}

export function savePushSubscription(
  db: DatabaseSync,
  userId: string,
  sub: PushSubscriptionRecord,
) {
  const endpoint = validatePushEndpoint(sub.endpoint);
  const p256dhBytes = Buffer.from(sub.p256dh, "base64url");
  const authBytes = Buffer.from(sub.auth, "base64url");
  if (p256dhBytes.length !== 65 || p256dhBytes[0] !== 0x04) {
    throw new Error("Invalid push subscription public key.");
  }
  if (authBytes.length !== 16) {
    throw new Error("Invalid push subscription auth secret.");
  }
  const locale = sub.locale === "tr" ? "tr" : "en";
  db.exec("BEGIN IMMEDIATE");
  try {
    // One browser endpoint belongs to at most one signed-in account at a time.
    db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(endpoint);
    db.prepare(
      "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, locale, created) VALUES (?,?,?,?,?,?)",
    ).run(userId, endpoint, sub.p256dh, sub.auth, locale, Date.now());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function removePushSubscription(
  db: DatabaseSync,
  userId: string,
  endpoint: string,
) {
  db.prepare(
    "DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?",
  ).run(userId, endpoint);
}

export function hasPushSubscription(
  db: DatabaseSync,
  userId: string,
  endpoint: string,
): boolean {
  return !!db
    .prepare(
      "SELECT 1 FROM push_subscriptions WHERE user_id=? AND endpoint=?",
    )
    .get(userId, endpoint);
}

export function listPushSubscriptions(
  db: DatabaseSync,
  userId: string,
): PushSubscriptionRecord[] {
  return db
    .prepare(
      "SELECT endpoint, p256dh, auth, locale FROM push_subscriptions WHERE user_id=?",
    )
    .all(userId)
    .map((row) => ({
      endpoint: String(row.endpoint),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
      locale: String(row.locale || "en"),
    }));
}

// RFC 8292 VAPID Authorization header using ES256 (IEEE P1363 signature).
export function buildVapidHeader(
  endpoint: string,
  keys: VapidKeys,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const aud = new URL(endpoint).origin;
  const header = Buffer.from(
    JSON.stringify({ typ: "JWT", alg: "ES256" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      aud,
      exp: nowSeconds + 12 * 60 * 60,
      sub: keys.subject,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const rawPub = Buffer.from(keys.publicKey, "base64url");
  if (rawPub.length !== 65 || rawPub[0] !== 0x04) {
    throw new Error("Invalid VAPID public key.");
  }
  const keyObj = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: rawPub.subarray(1, 33).toString("base64url"),
      y: rawPub.subarray(33, 65).toString("base64url"),
      d: keys.privateKey,
    },
    format: "jwk",
  });
  const sig = sign("sha256", Buffer.from(unsigned), {
    key: keyObj,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `vapid t=${unsigned}.${sig}, k=${keys.publicKey}`;
}

// RFC 8291 (aes128gcm) Web Push payload encryption.
export function encryptPushPayload(
  payload: string | Buffer,
  p256dhBase64Url: string,
  authBase64Url: string,
): Buffer {
  const plaintext = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(payload, "utf8");
  if (plaintext.length > MAX_PAYLOAD_BYTES) {
    throw new Error("Push payload exceeds maximum Web Push record size.");
  }
  const uaPublic = Buffer.from(p256dhBase64Url, "base64url");
  const authSecret = Buffer.from(authBase64Url, "base64url");
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error("Invalid subscription p256dh key.");
  }
  if (authSecret.length !== 16) {
    throw new Error("Invalid subscription auth secret.");
  }

  const ecdh = createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const ecdhSecret = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    uaPublic,
    asPublic,
  ]);
  const ikm = Buffer.from(
    hkdfSync("sha256", ecdhSecret, authSecret, keyInfo, 32),
  );

  const salt = randomBytes(16);
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

  // Delimiter 0x02 marks the final record (RFC 8188).
  const padded = Buffer.concat([plaintext, Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()]);
  const tag = cipher.getAuthTag();

  const header = Buffer.alloc(16 + 4 + 1 + asPublic.length);
  salt.copy(header, 0);
  header.writeUInt32BE(AES128GCM_RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  asPublic.copy(header, 21);

  return Buffer.concat([header, ciphertext, tag]);
}

function sanitizeTopic(topic?: string): string | undefined {
  if (!topic) return undefined;
  const cleaned = topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return cleaned || undefined;
}

export async function sendWebPush(
  sub: PushSubscriptionRecord,
  message: PushMessage,
  keys: VapidKeys,
  options: SendPushOptions = {},
): Promise<{ status: number; expired: boolean }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const body = encryptPushPayload(
    JSON.stringify(message),
    sub.p256dh,
    sub.auth,
  );
  const headers: Record<string, string> = {
    Authorization: buildVapidHeader(sub.endpoint, keys),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(options.ttl ?? 86400),
    Urgency: options.urgency ?? "normal",
  };
  const topic = sanitizeTopic(options.topic ?? message.tag);
  if (topic) headers.Topic = topic;

  const res = await fetchImpl(sub.endpoint, {
    method: "POST",
    headers,
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(15_000),
  });
  return {
    status: res.status,
    expired: res.status === 404 || res.status === 410,
  };
}

// Dispatches a notification to every subscribed device of `userId`, rendering
// per-device localized messages and pruning expired (404/410) subscriptions.
export async function sendUserNotification(
  db: DatabaseSync,
  userId: string,
  keys: VapidKeys,
  build: PushMessage | ((locale: string) => PushMessage | null),
  options: SendPushOptions = {},
): Promise<{ sent: number; failed: number; pruned: number }> {
  const subs = listPushSubscriptions(db, userId);
  let sent = 0;
  let failed = 0;
  let pruned = 0;
  for (const sub of subs) {
    const message = typeof build === "function" ? build(sub.locale) : build;
    if (!message) continue;
    try {
      const result = await sendWebPush(sub, message, keys, options);
      if (result.status >= 200 && result.status < 300) {
        sent++;
      } else if (result.expired) {
        removePushSubscription(db, userId, sub.endpoint);
        pruned++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  return { sent, failed, pruned };
}
