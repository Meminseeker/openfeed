import { resolveVideoDates } from "./youtube-dates.ts";
import { cleanPastedUrl } from "../src/clean-url.ts";
import { fetchPublicPage as page } from "./public-page.ts";
import { initialData, publicPosts } from "./youtube.ts";
import { fetchXStatus } from "./x.ts";
import { pagePost, instagramPosts } from "./instagram.ts";
import { syncTikTok } from "./tiktok.ts";
import type { Post, Playlist } from "../src/types.ts";
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
  const u = new URL(input.trim());
  if (u.protocol !== "https:" || u.port || u.username || u.password)
    throw new Error(
      "Paste an HTTPS link from YouTube, X, Instagram or TikTok.",
    );
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
      throw new Error(
        "Paste a YouTube video link. Use Playlists for playlist links.",
      );
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
  throw new Error(
    "Use a public YouTube video, X post, Instagram post/Reel, or TikTok video link.",
  );
}
export async function resolveSharedUrl(input: string) {
  let url = new URL(cleanPastedUrl(input));
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
        throw new Error("Invalid TikTok redirect.");
      const r = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const location = r.headers.get("location");
      if (!location) break;
      url = new URL(cleanPastedUrl(new URL(location, url).href));
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
      if (!post) throw new Error("YouTube did not expose this community post.");
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
      )
    ).json()) as any;
    return {
      name: data.author_name || "YouTube",
      post: {
        ...base,
        title: data.title || "YouTube video",
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
    if (!media)
      throw new Error(
        "Instagram did not expose this public post. Private or login-only content cannot be imported.",
      );
    const name = media.owner?.username || "Instagram";
    const post = instagramPosts([media], name.toLowerCase(), base.creatorId, [
      "post",
      "short",
      "video",
    ])[0];
    if (!post) throw new Error("Instagram content unavailable.");
    return { name, post: { ...post, libraryOnly: true } };
  }
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
    throw new Error(
      "TikTok did not expose this video. It may be unavailable or require login.",
    );
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
  const u = new URL(input.trim());
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
    throw new Error("Paste a public YouTube playlist link.");
  return id;
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
    if (k === "continuationItemRenderer")
      continuation = v.continuationEndpoint?.continuationCommand?.token;
  });
  return { posts, continuation };
}
export async function importPlaylist(
  input: string,
  existing: Post[] = [],
): Promise<{ playlist: Playlist; posts: Post[] }> {
  const id = playlistId(input),
    url = `https://www.youtube.com/playlist?list=${id}`;
  const html = await (await page(url)).text();
  const data = initialData(html);
  const title =
    data.metadata?.playlistMetadataRenderer?.title || "YouTube playlist";
  let batch = playlistPage(data, `playlist:${id}`);
  const collected = new Map(batch.posts.map((p) => [p.id, p]));
  const contextMatch = html.match(
    /"INNERTUBE_CONTEXT"\s*:\s*(\{[\s\S]*?\}),"[A-Z_]+"/,
  );
  let context: any;
  try {
    context = JSON.parse(contextMatch?.[1] || "null");
  } catch {}
  context ||= {
    client: {
      clientName: "WEB",
      clientVersion:
        html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1] ||
        "2.20261027.01.00",
      hl: "en",
    },
  };
  let warning: string | undefined;
  for (let n = 0; batch.continuation && n < 20; n++) {
    try {
      const r = await fetch("https://www.youtube.com/youtubei/v1/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, continuation: batch.continuation }),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error();
      batch = playlistPage(await r.json(), `playlist:${id}`);
      for (const p of batch.posts) collected.set(p.id, p);
    } catch {
      warning =
        "Some playlist pages could not load. Refresh this playlist to retry.";
      break;
    }
  }
  if (batch.continuation && !warning)
    warning =
      "Only the first 21 pages were imported. This playlist exceeds the import limit.";
  if (!collected.size)
    throw new Error(
      "No playable videos found. Use a public or unlisted YouTube playlist.",
    );
  const missingDates = await resolveVideoDates(
    [...collected.values()],
    existing,
  );
  if (missingDates)
    warning = [
      warning,
      `Exact publication dates unavailable for ${missingDates} videos; their chronological order may be approximate. Refresh to retry.`,
    ]
      .filter(Boolean)
      .join(" ");
  return {
    playlist: { id, title, url, postIds: [...collected.keys()], warning },
    posts: [...collected.values()],
  };
}
