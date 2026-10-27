import type { Post } from "../src/types.ts";

export function tiktokUsername(input: string) {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["www.tiktok.com", "tiktok.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("Use a TikTok username or HTTPS profile URL.");
    if (!/^\/@[^/]+\/?$/.test(url.pathname))
      throw new Error("Use a TikTok profile URL, not a video URL.");
    value = url.pathname.slice(1).replace(/\/$/, "");
  }
  value = value.replace(/^@/, "");
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.]{0,23}$/.test(value) || value.endsWith("."))
    throw new Error("Enter a valid TikTok username (up to 24 characters).");
  return value.toLowerCase();
}

export function parseTikTokProfile(
  html: string,
  input: string,
  creatorId: string,
) {
  const username = tiktokUsername(input);
  const posts = new Map<string, Post>();
  function walk(value: any, depth = 0) {
    if (!value || typeof value !== "object" || depth > 60) return;
    const author =
      typeof value.author === "string" ? value.author : value.author?.uniqueId;
    if (
      typeof author === "string" &&
      author.toLowerCase() === username &&
      /^\d{10,25}$/.test(String(value.id)) &&
      value.video &&
      !value.isAd
    ) {
      const date = new Date(Number(value.createTime) * 1000);
      const id = String(value.id);
      const text = typeof value.desc === "string" ? value.desc : "";
      const cover = value.video.cover;
      let image: string | undefined;
      try {
        const url = new URL(cover);
        if (url.protocol === "https:" && !url.username && !url.password)
          image = url.href;
      } catch {}
      posts.set(`tiktok:${id}`, {
        id: `tiktok:${id}`,
        creatorId,
        platform: "tiktok",
        sourceUsername: username,
        videoId: id,
        title: text.split("\n")[0].slice(0, 160) || "TikTok video",
        text,
        image,
        url: `https://www.tiktok.com/@${username}/video/${id}`,
        kind: "video",
        published:
          Number.isFinite(date.getTime()) && Number(value.createTime) > 0
            ? date.toISOString()
            : "",
        read: false,
        saved: false,
      });
    }
    for (const child of Object.values(value)) walk(child, depth + 1);
  }
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(match[1]));
    } catch {}
  }
  if (!posts.size)
    throw new Error(
      "TikTok did not expose public videos. The profile may be empty, private, or blocked by TikTok. Try refreshing later; existing posts are kept.",
    );
  return {
    posts: [...posts.values()],
    warning:
      "TikTok imports the recent videos exposed by its public profile; a complete timeline is not guaranteed.",
  };
}

export async function syncTikTok(input: string, creatorId: string) {
  const username = tiktokUsername(input);
  const response = await fetch(`https://www.tiktok.com/@${username}`, {
    headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      `TikTok public profile unavailable (HTTP ${response.status}).`,
    );
  return parseTikTokProfile(await response.text(), username, creatorId);
}
