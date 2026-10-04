import type { Request, Response as ExpressResponse } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Post } from "../src/types.ts";

export function xVideoUrl(post: Post | undefined, index: string) {
  if (post?.platform !== "x" || !/^(0|[1-9]\d*)$/.test(index)) return;
  const value = post.videos?.[Number(index)]?.url;
  if (!value) return;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "video.twimg.com" &&
      !url.username &&
      !url.password &&
      !url.port
    )
      return url.href;
  } catch {}
}

export async function streamXVideo(
  req: Request,
  res: ExpressResponse,
  url: string,
) {
  const range = req.headers.range;
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    res.status(400).json({ error: "Invalid video range." });
    return;
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  res.once("close", cancel);
  const timeout = setTimeout(cancel, 20000);
  try {
    const upstream = await fetch(url, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: range ? { Range: range } : {},
      redirect: "error",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (![200, 206, 416].includes(upstream.status)) {
      await upstream.body?.cancel();
      res
        .status(502)
        .json({ error: "X video is unavailable. Try refreshing the source." });
      return;
    }
    if (
      upstream.status !== 416 &&
      !/^video\//i.test(upstream.headers.get("content-type") || "")
    ) {
      await upstream.body?.cancel();
      res.status(502).json({ error: "X did not return a video." });
      return;
    }
    res.status(upstream.status);
    for (const name of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
    ]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method === "HEAD" || !upstream.body) res.end();
    else await pipeline(Readable.fromWeb(upstream.body as any), res);
  } catch {
    if (!res.headersSent && !res.destroyed)
      res.status(502).json({ error: "X video could not be loaded." });
    else if (!res.destroyed) res.destroy();
  } finally {
    clearTimeout(timeout);
    res.off("close", cancel);
  }
}
