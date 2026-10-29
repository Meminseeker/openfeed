import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("production starts under plain Node without a TypeScript transpiler", async () => {
  const dir = mkdtempSync(join(tmpdir(), "openfeed-runtime-"));
  const proc = spawn(process.execPath, ["server/index.ts"], {
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "0",
      OPENFEED_DB: join(dir, "test.db"),
      OPENFEED_PUBLIC_ORIGIN: "",
      OPENFEED_RETENTION_DAYS: "7",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let errors = "";
  proc.stderr.on("data", (chunk) => {
    errors += String(chunk);
  });
  try {
    const base = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Production startup timed out: ${errors}`));
      }, 10000);
      proc.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      proc.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Production exited (${code}): ${errors}`));
      });
      proc.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      });
    });
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    assert.equal((await fetch(`${base}/api/state`)).status, 401);
  } finally {
    if (proc.exitCode === null && proc.signalCode === null)
      await new Promise<void>((resolve) => {
        proc.once("exit", () => resolve());
        proc.kill("SIGTERM");
      });
    rmSync(dir, { recursive: true, force: true });
  }
});
