import { XMLParser } from "fast-xml-parser";
import type { Post } from "../src/types.ts";
const text = (v: any): string =>
  v?.simpleText || v?.runs?.map((r: any) => r.text).join("") || "";
export function initialData(html: string): any {
  const marker =
    /(?:var\s+ytInitialData|window\["ytInitialData"\]|ytInitialData)\s*=\s*/g;
  const match = marker.exec(html);
  if (!match)
    throw new Error("YouTube page data unavailable. Please retry later.");
  const start = match.index + match[0].length;
  let depth = 0,
    quoted = false,
    escape = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') quoted = false;
    } else {
      if (c === '"') quoted = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0)
        return JSON.parse(html.slice(start, i + 1));
    }
  }
  throw new Error("Incomplete YouTube page data.");
}
function walk(value: any, fn: (key: string, value: any) => void) {
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value)) {
    fn(k, v);
    walk(v, fn);
  }
}
export function publicPosts(
  data: any,
  creatorId: string,
  kind: "video" | "short" | "community",
  channelId?: string,
): Post[] {
  let selected: any;
  walk(data, (k, v) => {
    if (k === "tabRenderer" && v.selected) selected = v.content;
  });
  if (selected) data = selected;
  const posts = new Map<string, Post>();
  walk(data, (key, v) => {
    if (kind === "video" && key === "videoRenderer" && v.videoId) {
      const id = v.videoId;
      posts.set(id, {
        id,
        creatorId,
        title: text(v.title),
        image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
        kind,
        published: relativeDate(text(v.publishedTimeText)),
        publishedApproximate: true,
        duration: text(v.lengthText),
        read: false,
        saved: false,
      });
    }
    if (
      kind === "video" &&
      key === "lockupViewModel" &&
      v.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" &&
      v.contentId
    ) {
      const id = v.contentId,
        meta = v.metadata?.lockupMetadataViewModel;
      const parts =
        meta?.metadata?.contentMetadataViewModel?.metadataRows?.flatMap(
          (r: any) => r?.metadataParts || [],
        ) || [];
      const relative =
        parts
          .map((p: any) => p?.accessibilityLabel || p?.text?.content || "")
          .find((t: string) =>
            /\d+\s+(minute|hour|day|week|month|year)/.test(t),
          ) || "";
      const overlays = v.contentImage?.thumbnailViewModel?.overlays || [];
      let duration = "";
      walk(overlays, (k, x) => {
        if (k === "thumbnailBadgeViewModel" && /^\d+:/.test(x.text))
          duration = x.text;
      });
      posts.set(id, {
        id,
        creatorId,
        title: meta?.title?.content || "YouTube video",
        image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
        kind,
        published: relativeDate(relative),
        publishedApproximate: true,
        duration,
        read: false,
        saved: false,
      });
    }
    if (kind === "short") {
      const id =
        v?.videoId || v?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
      if (
        (key === "reelItemRenderer" ||
          key === "shortsLockupViewModel" ||
          key === "videoRenderer") &&
        id
      ) {
        posts.set(id, {
          id,
          creatorId,
          title:
            text(v.headline) ||
            text(v.title) ||
            v.overlayMetadata?.primaryText?.content ||
            "YouTube Short",
          image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          url: `https://www.youtube.com/shorts/${id}`,
          kind,
          published: "",
          read: false,
          saved: false,
        });
      }
    } else if (key === "backstagePostRenderer" && v.postId) {
      if (
        channelId &&
        (v.authorEndpoint?.browseEndpoint?.browseId ||
          v.authorText?.runs?.[0]?.navigationEndpoint?.browseEndpoint
            ?.browseId) !== channelId
      )
        return;
      const id = v.postId;
      const thumbs =
        v.backstageAttachment?.backstageImageRenderer?.image?.thumbnails;
      posts.set(id, {
        id,
        creatorId,
        title: "Community post",
        text: text(v.contentText),
        image: thumbs?.at(-1)?.url,
        url: `https://www.youtube.com/post/${id}`,
        kind,
        published: relativeDate(text(v.publishedTimeText)),
        publishedApproximate: true,
        read: false,
        saved: false,
      });
    }
  });
  return [...posts.values()];
}
function relativeDate(s: string) {
  const m = s.match(/(\d+)\s+(minute|hour|day|week|month|year)/);
  if (!m) return "";
  const scale: Record<string, number> = {
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
    year: 31536000,
  };
  return new Date(Date.now() - Number(m[1]) * scale[m[2]] * 1000).toISOString();
}
async function get(url: string) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!r.ok) throw new Error(`YouTube returned ${r.status}. Try again later.`);
  return r.text();
}
export function channelPath(input: string) {
  let s = input.trim();
  if (s.startsWith("http")) {
    const u = new URL(s);
    if (
      !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
    )
      throw new Error("Enter a YouTube channel URL, handle, or channel ID.");
    if (!/^\/(?:@[^/]+|channel\/UC[\w-]{22})(?:\/|$)/.test(u.pathname))
      throw new Error("Use a channel URL, not a video or playlist URL.");
    s = u.pathname
      .replace(/^\//, "")
      .split("/")
      .slice(0, u.pathname.includes("/channel/") ? 2 : 1)
      .join("/");
  }
  if (/^UC[\w-]{22}$/.test(s)) return `channel/${s}`;
  if (s.startsWith("channel/") && /^UC[\w-]{22}$/.test(s.slice(8))) return s;
  if (/^@?[\p{L}\p{N}_.-]{3,50}$/u.test(s))
    return s.startsWith("@") ? s : `@${s}`;
  throw new Error("Enter a YouTube @handle or /channel/ URL.");
}
export async function resolveChannel(input: string) {
  const path = channelPath(input);
  const html = await get(`https://www.youtube.com/${path}`);
  const data = initialData(html);
  let id = "",
    name = "",
    avatar = "";
  walk(data, (k, v) => {
    if (k === "channelMetadataRenderer") {
      id = v.externalId;
      name = v.title;
      avatar = v.avatar?.thumbnails?.at(-1)?.url || "";
    }
  });
  if (!/^UC[\w-]{22}$/.test(id))
    throw new Error("Could not find this public YouTube channel.");
  return { id, name, avatar };
}
export async function syncChannel(channelId: string, creatorId: string) {
  const xml = await get(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
  );
  const feed = new XMLParser({ ignoreAttributes: false }).parse(xml).feed;
  const entries = feed?.entry
    ? Array.isArray(feed.entry)
      ? feed.entry
      : [feed.entry]
    : [];
  const posts: Post[] = entries.map((e: any) => ({
    id: e["yt:videoId"],
    creatorId,
    title: e.title,
    url: `https://www.youtube.com/watch?v=${e["yt:videoId"]}`,
    image: `https://i.ytimg.com/vi/${e["yt:videoId"]}/hqdefault.jpg`,
    kind: "video",
    published: e.published,
    read: false,
    saved: false,
  }));
  const warnings: string[] = [];
  for (const kind of ["video", "short", "community"] as const) {
    try {
      const data = initialData(
        await get(
          `https://www.youtube.com/channel/${channelId}/${kind === "short" ? "shorts" : kind === "video" ? "videos" : "posts"}`,
        ),
      );
      const extras = publicPosts(data, creatorId, kind, channelId);
      for (const p of extras) {
        const existing = posts.find((x) => x.id === p.id);
        if (existing) {
          existing.kind = kind;
          existing.url = p.url;
          existing.duration = p.duration || existing.duration;
        } else posts.push(p);
      }
    } catch {
      warnings.push(
        `${kind === "short" ? "Shorts classification" : kind === "video" ? "Videos tab" : "Community posts"} unavailable`,
      );
    }
  }
  return { posts, warning: warnings.join("; ") };
}
