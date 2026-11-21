import type { Post } from "../src/types.ts";
import {
  notice,
  noticesText,
  UserError,
  userError,
  type Notice,
} from "../src/notices/index.ts";

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
      throw userError("tiktok.invalidUrl");
    if (!/^\/@[^/]+\/?$/.test(url.pathname)) throw userError("tiktok.videoUrl");
    value = url.pathname.slice(1).replace(/\/$/, "");
  }
  value = value.replace(/^@/, "");
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.]{0,23}$/.test(value) || value.endsWith("."))
    throw userError("tiktok.invalidUsername");
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
  if (!posts.size) throw userError("tiktok.profileNoVideos", { end: "" });
  const warningNotices = [notice("tiktok.profileCoverage")];
  return {
    posts: [...posts.values()],
    warning: noticesText(warningNotices),
    warningNotices,
  };
}

function tikTokMedia(value: unknown) {
  if (typeof value !== "string") return;
  try {
    const u = new URL(value);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      ["tiktokcdn.com", "tiktokcdn-us.com", "tiktok.com"].some(
        (host) => u.hostname === host || u.hostname.endsWith(`.${host}`),
      )
    )
      return u.href;
  } catch {}
}

// Creator embeds include a server-rendered videoList; normal profile pages
// often contain only user metadata and load the timeline with JavaScript.
export function parseTikTokEmbed(
  html: string,
  input: string,
  creatorId: string,
) {
  const username = tiktokUsername(input);
  let entry: any;
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]).source?.data;
      entry = data?.[`/embed/@${username}`] ?? data?.[`/embed/@${username}/`];
      if (entry) break;
    } catch {}
  }
  if (entry?.userInfo?.privateAccount) throw new PrivateTikTokProfile();
  if (
    !entry?.isReady ||
    entry.isError ||
    entry.userInfo?.uniqueId?.toLowerCase() !== username ||
    !Array.isArray(entry.videoList)
  )
    throw userError("tiktok.embedNoList", { end: "" });
  const posts = new Map<string, Post>();
  for (const item of entry.videoList) {
    if (
      typeof item.id !== "string" ||
      !/^\d{10,20}$/.test(item.id) ||
      item.authorUniqueId?.toLowerCase() !== username ||
      item.privateItem ||
      item.isAd
    )
      continue;
    // The embed omits createTime. TikTok IDs carry Unix seconds in their
    // upper 32 bits; keep this date explicitly approximate, never use fetch time.
    const seconds = Number(BigInt(item.id) >> 32n);
    const plausible =
      seconds >= 1451606400 && seconds <= Date.now() / 1000 + 86400;
    const text = typeof item.desc === "string" ? item.desc : "";
    let image: string | undefined;
    try {
      const url = new URL(item.coverUrl);
      if (url.protocol === "https:" && !url.username && !url.password)
        image = url.href;
    } catch {}
    posts.set(`tiktok:${item.id}`, {
      id: `tiktok:${item.id}`,
      creatorId,
      platform: "tiktok",
      sourceUsername: username,
      videoId: item.id,
      videos: tikTokMedia(item.playAddr)
        ? [{ url: tikTokMedia(item.playAddr)!, poster: image }]
        : undefined,
      title: text.split("\n")[0].slice(0, 160) || "TikTok video",
      text,
      image,
      url: `https://www.tiktok.com/@${username}/video/${item.id}`,
      kind: "video",
      published: plausible ? new Date(seconds * 1000).toISOString() : "",
      publishedApproximate: plausible || undefined,
      read: false,
      saved: false,
    });
  }
  if (entry.videoList.length && !posts.size)
    throw userError("tiktok.embedNoUsable", { end: "" });
  const warningNotices = [notice("tiktok.embedCoverage")];
  return {
    posts: [...posts.values()],
    warning: noticesText(warningNotices),
    warningNotices,
  };
}
class PrivateTikTokProfile extends UserError {
  constructor() {
    super(notice("tiktok.privateAccount"));
  }
}

// One failure inside "TikTok refresh failed: …". Its last notice gets the
// separator through {end}, so the English stays "a; b. Existing posts…".
function failureNotices(error: unknown): Notice[] {
  if (error instanceof UserError && error.notices.length) {
    const last = error.notices[error.notices.length - 1];
    if (last.params && "end" in last.params)
      return error.notices.map((n) => ({
        ...n,
        params: n.params ? { ...n.params } : undefined,
      }));
  }
  return [
    notice("tiktok.requestFailure", {
      message: error instanceof Error ? error.message : "Request failed",
      end: "",
    }),
  ];
}

export async function syncTikTok(input: string, creatorId: string) {
  const username = tiktokUsername(input);
  const failures: Notice[][] = [];
  for (const [path, parse] of [
    [`/embed/@${username}`, parseTikTokEmbed],
    [`/@${username}`, parseTikTokProfile],
  ] as const) {
    try {
      const response = await fetch(`https://www.tiktok.com${path}`, {
        headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw userError("tiktok.httpStatus", {
          status: response.status,
          end: "",
        });
      const html = await response.text();
      if (/SlardarWAF|overload-protect triggered/.test(html))
        throw userError("tiktok.blocked", { end: "" });
      return parse(html, username, creatorId);
    } catch (error) {
      if (error instanceof PrivateTikTokProfile) throw error;
      failures.push(failureNotices(error));
    }
  }
  failures.forEach((failure, index) => {
    const last = failure[failure.length - 1];
    last.params = {
      ...last.params,
      end: index === failures.length - 1 ? "." : ";",
    };
  });
  throw new UserError([
    notice("tiktok.refreshFailed"),
    ...failures.flat(),
    notice("tiktok.postsKept"),
  ]);
}
