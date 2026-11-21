import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  describeProblem,
  noticesText,
  userError,
  type Notice,
} from "../src/notices/index.ts";
import { xUsername } from "../server/x.ts";

test("login says when no account has the username, and auth errors carry translatable notices", async () => {
  const dir = mkdtempSync(join(tmpdir(), "openfeed-auth-"));
  const proc = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "0",
      OPENFEED_DB: join(dir, "test.db"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const base = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Server did not start")),
        10000,
      );
      proc.stdout!.on("data", (chunk) => {
        const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      });
    });
    const post = async (action: string, body: unknown) => {
      const res = await fetch(`${base}/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return {
        status: res.status,
        body: (await res.json()) as { error?: string; notices?: Notice[] },
      };
    };
    const password = "a-long-test-password";
    const check = (
      result: Awaited<ReturnType<typeof post>>,
      status: number,
      code: string,
      params?: Record<string, string>,
    ) => {
      assert.equal(result.status, status);
      assert.deepEqual(result.body.notices, [
        params ? { code, params } : { code },
      ]);
      // The English text stays available for clients that ignore notices.
      assert.equal(result.body.error, noticesText(result.body.notices!));
    };

    const missing = await post("login", { username: "Nobody", password });
    check(missing, 401, "auth.noAccount", { username: "nobody" });
    assert.match(missing.body.error!, /no account with the username “nobody”/);

    check(
      await post("login", { username: "a!", password }),
      400,
      "auth.invalidUsername",
    );
    check(
      await post("signup", { username: "reader", password: "short" }),
      400,
      "auth.invalidPassword",
    );
    assert.equal(
      (await post("signup", { username: "reader", password })).status,
      200,
    );
    check(
      await post("signup", { username: "reader", password }),
      409,
      "auth.usernameTaken",
    );
    check(
      await post("login", { username: "reader", password: `${password}!` }),
      401,
      "auth.wrongPassword",
      { username: "reader" },
    );
    assert.equal(
      (await post("login", { username: "reader", password })).status,
      200,
    );
    const state = await fetch(`${base}/api/state`);
    assert.equal(state.status, 401);
    assert.deepEqual((await state.json()).notices, [
      { code: "auth.loginRequired" },
    ]);
  } finally {
    proc.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("raw invalid-URL errors and errors carrying notices are translatable with unchanged English", () => {
  let thrown: unknown;
  try {
    xUsername("https://");
  } catch (e) {
    thrown = e;
  }
  const invalid = describeProblem(thrown);
  assert.equal(invalid.text, "Invalid URL");
  assert.deepEqual(invalid.notices, [{ code: "common.invalidUrl" }]);
  assert.equal(noticesText(invalid.notices!), invalid.text);

  const wrapped = Object.assign(new Error("Incorrect password for “a”."), {
    notices: userError("auth.wrongPassword", { username: "a" }).notices,
  });
  const carried = describeProblem(wrapped);
  assert.equal(carried.notices?.[0]?.code, "auth.wrongPassword");
  assert.equal(noticesText(carried.notices!), carried.text);
});
