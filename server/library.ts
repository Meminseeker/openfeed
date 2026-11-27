import { resolveVideoDates } from "./youtube-dates.ts";
import { cleanPastedUrl } from "../src/clean-url.ts";
import { fetchPublicPage as page } from "./public-page.ts";
import { initialData, publicPosts } from "./youtube.ts";
import { fetchXStatus } from "./x.ts";
import { pagePost, instagramPosts } from "./instagram.ts";
import { syncTikTok } from "./tiktok.ts";
import { fetchLinkedInPost, linkedinPostRef } from "./linkedin.ts";
import type { Post, Playlist } from "../src/types.ts";
import { notice, noticesText, userError } from "../src/notices/index.ts";
import type { Notice } from "../src/notices/index.ts";
// URL parsing errors reach the user, so they carry a notice.
function parseUrl(value: string, base?: URL | string) {
  try {
    return new URL(value, base);
  } catch {
    throw userError("library.invalidUrl");
  }
}
const text = (v: any): string =>
  v?.simpleText || v?.runs?.map((r: any) => r.text).join("") || "";
function walk(v: any, fn: (k: string, v: any) => void) {
  if (!v || typeof v !== "object") return;
  for (const [k, c] of Object.entries(v)) {
    fn(k, c);
    walk(c, fn);
  }
}
export function contentUrl(input: string) {
  const u = parseUrl(input.trim());
  if (u.protocol !== "https:" || u.port || u.username || u.password)
    throw userError("library.httpsLinkRequired");
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtube.com" || host === "youtu.be") {
    const community =
      host === "youtube.com" &&
      u.pathname.match(/^\/post\/(Ug[\w-]{10,150})\/?$/)?.[1];
    if (community)
      return {
        platform: "youtube" as const,
        id: community,
        url: `https://www.youtube.com/post/${community}`,
        community: true,
      };
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : u.searchParams.get("v") ||
          u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)\/?$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id))
      throw userError("library.youtubeVideoLinkRequired");
    return {
      platform: "youtube" as const,
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      short: u.pathname.startsWith("/shorts/"),
    };
  }
  if (["x.com", "twitter.com"].includes(host)) {
    const m = u.pathname.match(/^\/(?:[\w]{1,15}|i\/web)\/status\/(\d+)\/?$/);
    if (m)
      return {
        platform: "x" as const,
        id: m[1],
        url: `https://x.com/${u.pathname.split("/")[1] === "i" ? "i" : u.pathname.split("/")[1]}/status/${m[1]}`,
      };
  }
  if (host === "instagram.com") {
    const m = u.pathname.match(/^\/(p|reel|tv)\/([\w-]+)\/?$/);
    if (m)
      return {
        platform: "instagram" as const,
        id: m[2],
        url: `https://www.instagram.com/${m[1]}/${m[2]}/`,
      };
  }
  if (host === "tiktok.com") {
    const m = u.pathname.match(/^\/@([\w.]{1,24})\/video\/(\d+)\/?$/);
    if (m)
      return {
        platform: "tiktok" as const,
        id: m[2],
        username: m[1],
        url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}`,
      };
  }
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    const ref = linkedinPostRef(u.href);
    if (ref) return { platform: "linkedin" as const, id: ref.id, url: ref.url };
  }
  throw userError("library.unsupportedLink");
}
export async function resolveSharedUrl(input: string) {
  let url = parseUrl(cleanPastedUrl(input));
  // Only platform-owned shorteners may redirect, and every hop is validated.
  if (
    ["vm.tiktok.com", "vt.tiktok.com"].includes(url.hostname) ||
    (["www.tiktok.com", "tiktok.com"].includes(url.hostname) &&
      url.pathname.startsWith("/t/"))
  ) {
    for (let i = 0; i < 5; i++) {
      if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        !(url.hostname === "tiktok.com" || url.hostname.endsWith(".tiktok.com"))
      )
        throw userError("library.invalidTikTokRedirect");
      const r = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const location = r.headers.get("location");
      if (!location) break;
      url = parseUrl(cleanPastedUrl(parseUrl(location, url).href));
    }
  }
  return contentUrl(url.href);
}
export async function importLink(
  input: string,
): Promise<{ post: Post; name: string }> {
  const link = await resolveSharedUrl(input);
  const base: Post = {
    id: link.platform === "youtube" ? link.id : `${link.platform}:${link.id}`,
    creatorId: `library:${link.platform}`,
    platform: link.platform,
    title: "",
    url: link.url,
    kind: "post",
    published: "",
    read: false,
    saved: false,
    libraryOnly: true,
  };
  if (link.platform === "youtube") {
    if (link.community) {
      const data = initialData(await (await page(link.url)).text());
      const post = publicPosts(data, base.creatorId, "community").find(
        (p) => p.id === link.id,
      );
      if (!post) throw userError("library.youtubeCommunityUnavailable");
      let name = "YouTube";
      walk(data, (key, value) => {
        if (key === "backstagePostRenderer" && value.postId === link.id)
          name = text(value.authorText) || name;
      });
      return {
        name,
        post: { ...post, platform: "youtube", libraryOnly: true },
      };
    }
    const data = (await (
      await page(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(link.url)}&format=json`,
        { acceptLanguage: null },
      )
    ).json()) as any;
    return {
      name: data.author_name || "YouTube",
      post: {
        ...base,
        title: data.title || "YouTube video",
        titleOriginal: !!data.title,
        videoId: link.id,
        kind: link.short ? "short" : "video",
        image: `https://i.ytimg.com/vi/${link.id}/hqdefault.jpg`,
      },
    };
  }
  if (link.platform === "x") {
    const t = await fetchXStatus(link.url);
    const allowed = (url: string, host: string) => {
      try {
        const u = new URL(url);
        return u.protocol === "https:" &&
          u.hostname === host &&
          !u.username &&
          !u.password
          ? u.href
          : undefined;
      } catch {
        return undefined;
      }
    };
    const images = (t.media?.photos || [])
      .map((p: any) => allowed(p.url, "pbs.twimg.com"))
      .filter(Boolean);
    const videos = (t.media?.videos || [])
      .map((v: any) => ({
        url: allowed(v.url, "video.twimg.com"),
        poster: allowed(v.thumbnail_url, "pbs.twimg.com"),
      }))
      .filter((v: any) => v.url);
    return {
      name: t.author?.name || "X",
      post: {
        ...base,
        url: `https://x.com/${t.author?.screen_name || "i"}/status/${link.id}`,
        sourceUsername: t.author?.screen_name,
        title: t.text.split("\n")[0].slice(0, 160),
        text: t.text,
        textExpanded: true,
        textVersion: 2,
        images,
        videos,
        image: images[0] || videos[0]?.poster,
        published: new Date(t.created_timestamp * 1000).toISOString(),
      },
    };
  }
  if (link.platform === "instagram") {
    const html = await (await page(`${link.url}embed/captioned/`)).text();
    const media = pagePost(html, link.id);
    if (!media) throw userError("library.instagramNotExposed");
    const name = media.owner?.username || "Instagram";
    const post = instagramPosts([media], name.toLowerCase(), base.creatorId, [
      "post",
      "short",
      "video",
    ])[0];
    if (!post) throw userError("library.instagramUnavailable");
    return { name, post: { ...post, libraryOnly: true } };
  }
  if (link.platform === "linkedin")
    return fetchLinkedInPost(link.url, base.creatorId);
  let post: Post | undefined;
  try {
    post = (await syncTikTok(link.username!, base.creatorId)).posts.find(
      (p) => p.id === base.id,
    );
  } catch {}
  if (post)
    return { name: link.username!, post: { ...post, libraryOnly: true } };
  const data = (await (
    await page(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(link.url)}`,
    )
  ).json()) as any;
  if (
    typeof data.html !== "string" ||
    !data.html.includes(`data-video-id="${link.id}"`)
  )
    throw userError("library.tiktokNotExposed");
  return {
    name: data.author_name || link.username!,
    post: {
      ...base,
      title: data.title || "TikTok video",
      videoId: link.id,
      sourceUsername: link.username,
      kind: "video",
      image: data.thumbnail_url,
      published: new Date(Number(BigInt(link.id) >> 32n) * 1000).toISOString(),
    },
  };
}
export function playlistId(input: string) {
  const u = parseUrl(input.trim());
  const id = u.searchParams.get("list");
  if (
    u.protocol !== "https:" ||
    !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    !id ||
    !/^[\w-]{10,100}$/.test(id)
  )
    throw userError("library.playlistLinkRequired");
  return id;
}
function extractJsonObject(source: string, marker: RegExp): any {
  const match = marker.exec(source);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  let depth = 0,
    quoted = false,
    escape = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') quoted = false;
    } else {
      if (c === '"') quoted = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}
function continuationToken(renderer: any): string | undefined {
  const direct = renderer?.continuationEndpoint?.continuationCommand?.token;
  if (typeof direct === "string" && direct) return direct;
  const commands =
    renderer?.continuationEndpoint?.commandExecutorCommand?.commands;
  if (Array.isArray(commands)) {
    for (const cmd of commands) {
      const token = cmd?.continuationCommand?.token;
      if (typeof token === "string" && token) return token;
    }
  }
  const button =
    renderer?.button?.buttonRenderer?.command?.continuationCommand?.token;
  if (typeof button === "string" && button) return button;
  return undefined;
}
export function playlistPage(data: any, creatorId: string) {
  const posts: Post[] = publicPosts(
    data.contents || data,
    creatorId,
    "video",
  ).map((p) => ({ ...p, libraryOnly: true }));
  let continuation: string | undefined;
  walk(data, (k, v) => {
    if (
      k === "playlistVideoRenderer" &&
      /^[\w-]{11}$/.test(v.videoId) &&
      v.isPlayable !== false
    )
      posts.push({
        id: v.videoId,
        videoId: v.videoId,
        creatorId,
        platform: "youtube",
        title: text(v.title) || "YouTube video",
        image: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        kind: "video",
        published: "",
        duration: text(v.lengthText),
        read: false,
        saved: false,
        libraryOnly: true,
      });
    if (k === "continuationItemRenderer") {
      const token = continuationToken(v);
      if (token) continuation = token;
    }
  });
  return { posts, continuation };
}
export async function importPlaylist(
  input: string,
  existing: Post[] = [],
): Promise<{ playlist: Playlist; posts: Post[] }> {
  const id = playlistId(input),
    url = `https://www.youtube.com/playlist?list=${id}`;
  const html = await (await page(url, { acceptLanguage: null })).text();
  const data = initialData(html);
  const title =
    data.metadata?.playlistMetadataRenderer?.title || "YouTube playlist";
  let batch = playlistPage(data, `playlist:${id}`);
  const collected = new Map(batch.posts.map((p) => [p.id, p]));
  let context = extractJsonObject(html, /"INNERTUBE_CONTEXT"\s*:\s*/);
  const clientVersion =
    context?.client?.clientVersion ||
    html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1] ||
    "2.20261027.01.00";
  context ||= {
    client: {
      clientName: "WEB",
      clientVersion,
    },
  };
  const apiKey = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1];
  const browseUrl = apiKey
    ? `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`
    : "https://www.youtube.com/youtubei/v1/browse";
  const warningNotices: Notice[] = [];
  const seenTokens = new Set<string>();
  for (let n = 0; batch.continuation && n < 50; n++) {
    if (seenTokens.has(batch.continuation)) {
      batch.continuation = undefined;
      break;
    }
    seenTokens.add(batch.continuation);
    try {
      const r = await fetch(browseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          Origin: "https://www.youtube.com",
          "X-YouTube-Client-Name": "1",
          "X-YouTube-Client-Version": String(clientVersion),
        },
        body: JSON.stringify({ context, continuation: batch.continuation }),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error();
      batch = playlistPage(await r.json(), `playlist:${id}`);
      const before = collected.size;
      for (const p of batch.posts) collected.set(p.id, p);
      if (collected.size === before && !batch.posts.length) {
        batch.continuation = undefined;
        break;
      }
    } catch {
      warningNotices.push(notice("library.playlistPagesFailed"));
      break;
    }
  }
  if (batch.continuation && !warningNotices.length)
    warningNotices.push(notice("library.playlistPageLimit"));
  if (!collected.size) throw userError("library.playlistEmpty");
  const missingDates = await resolveVideoDates(
    [...collected.values()],
    existing,
  );
  if (missingDates)
    warningNotices.push(
      notice("library.playlistDatesMissing", { count: missingDates }),
    );
  const warning = warningNotices.length
    ? noticesText(warningNotices)
    : undefined;
  return {
    playlist: {
      id,
      title,
      url,
      postIds: [...collected.keys()],
      warning,
      ...(warningNotices.length ? { warningNotices } : {}),
    },
    posts: [...collected.values()],
  };
}
