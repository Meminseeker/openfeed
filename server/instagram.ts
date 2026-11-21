import type { Post, SyncType } from "../src/types.ts";
import { notice, noticesText, userError } from "../src/notices/index.ts";
import type { Notice } from "../src/notices/index.ts";

// A sync warning as English text plus the notices it was built from.
function warningPair(warningNotices: Notice[]) {
  return warningNotices.length
    ? { warning: noticesText(warningNotices), warningNotices }
    : { warning: undefined, warningNotices: undefined };
}
export function instagramUsername(input: string) {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw userError("instagram.invalidProfileUrl");
    value = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  }
  value = value.replace(/^@/, "");
  if (
    !/^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/.test(value) ||
    value.includes("..") ||
    ["accounts", "explore", "reels", "stories", "p", "reel", "direct"].includes(
      value.toLowerCase(),
    )
  )
    throw userError("instagram.invalidUsername");
  return value.toLowerCase();
}
function mediaUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const u = new URL(value);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ["cdninstagram.com", "fbcdn.net"].some(
        (host) => u.hostname === host || u.hostname.endsWith(`.${host}`),
      )
    )
      return u.href;
  } catch {}
}
export function instagramPosts(
  media: any[],
  username: string,
  creatorId: string,
  selected: SyncType[],
) {
  const posts = new Map<string, Post>();
  for (const m of media) {
    if (m.owner?.username && m.owner.username.toLowerCase() !== username)
      continue;
    if (m.owner?.is_private || m.is_ad) continue;
    const shortcode = m.shortcode || m.code;
    let url = m.permalink;
    if (url) {
      try {
        const u = new URL(url);
        if (
          u.protocol !== "https:" ||
          !["www.instagram.com", "instagram.com"].includes(u.hostname) ||
          !/^\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname)
        )
          continue;
      } catch {
        continue;
      }
    } else if (
      typeof shortcode === "string" &&
      /^[a-zA-Z0-9_-]+$/.test(shortcode)
    )
      url = `https://www.instagram.com/${m.product_type === "clips" ? "reel" : "p"}/${shortcode}/`;
    else continue;
    const id = new URL(url).pathname.split("/")[2];
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) continue;
    const kind =
      m.media_product_type === "REELS" || m.product_type === "clips"
        ? "short"
        : m.media_type === "VIDEO" || m.media_type === 2 || m.is_video
          ? "video"
          : "post";
    if (!selected.includes(kind)) continue;
    const children = m.children?.data ||
      m.edge_sidecar_to_children?.edges?.map((e: any) => e.node) ||
      m.carousel_media || [m];
    const images: string[] = [],
      videos: NonNullable<Post["videos"]> = [];
    for (const child of children) {
      const isVideo =
        child.media_type === "VIDEO" ||
        child.is_video ||
        child.media_type === 2;
      const image = mediaUrl(
        child.thumbnail_url ||
          child.display_url ||
          (!isVideo ? child.media_url : undefined) ||
          child.image_versions2?.candidates?.[0]?.url,
      );
      const video = mediaUrl(
        child.video_url ||
          (isVideo ? child.media_url : undefined) ||
          child.video_versions?.[0]?.url,
      );
      if (isVideo && video) videos.push({ url: video, poster: image });
      else if (image) images.push(image);
    }
    const caption =
      typeof m.caption === "string"
        ? m.caption
        : m.caption?.text ||
          m.edge_media_to_caption?.edges?.[0]?.node?.text ||
          "";
    const text = typeof caption === "string" ? caption : "";
    const date = m.timestamp
      ? new Date(m.timestamp)
      : m.taken_at_timestamp || m.taken_at
        ? new Date((m.taken_at_timestamp || m.taken_at) * 1000)
        : undefined;
    posts.set(`instagram:${id}`, {
      id: `instagram:${id}`,
      creatorId,
      platform: "instagram",
      sourceUsername: username,
      title: text.split("\n")[0]?.slice(0, 160) || "Instagram post",
      text,
      images,
      image: images[0] || videos[0]?.poster,
      videos,
      url,
      kind,
      published:
        date && Number.isFinite(date.getTime()) ? date.toISOString() : "",
      read: false,
      saved: false,
    });
  }
  return [...posts.values()];
}
// Extract JSON arguments without executing Instagram's scripts.
export function instagramPageData(html: string): any[] {
  const values: any[] = [];
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = match[1].trim();
    try {
      values.push(
        JSON.parse(
          script.replace(/^window\._sharedData\s*=\s*/, "").replace(/;$/, ""),
        ),
      );
    } catch {}
    for (const marker of script.matchAll(/\.handle\((\{)/g)) {
      const start = marker.index! + marker[0].length - 1;
      let depth = 0,
        quoted = false,
        escaped = false;
      for (let i = start; i < script.length; i++) {
        const char = script[i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === "{" || char === "[") depth++;
        else if (char === "}" || char === "]") {
          depth--;
          if (!depth) {
            try {
              values.push(JSON.parse(script.slice(start, i + 1)));
            } catch {}
            break;
          }
        }
      }
    }
  }
  return values;
}
function pageProfile(html: string, username: string) {
  let user: any;
  const media: any[] = [];
  function walk(value: any, depth = 0) {
    if (depth > 80) return;
    if (typeof value === "string" && /^[{[]/.test(value)) {
      try {
        walk(JSON.parse(value), depth + 1);
      } catch {}
      return;
    }
    if (!value || typeof value !== "object") return;
    if (
      typeof value.username === "string" &&
      value.username.toLowerCase() === username &&
      typeof value.is_private === "boolean"
    ) {
      if (!user || value.is_private) user = value;
      if (Array.isArray(value.edge_owner_to_timeline_media?.edges))
        media.push(
          ...value.edge_owner_to_timeline_media.edges.map((e: any) => e.node),
        );
    }
    if (value.shortcode_media?.owner?.username?.toLowerCase() === username)
      media.push(value.shortcode_media);
    for (const child of Object.values(value)) walk(child, depth + 1);
  }
  instagramPageData(html).forEach((v) => walk(v));
  return { user, media };
}
// Detail enrichment is limited to a shortcode already listed by the approved profile.
export function pagePost(html: string, shortcode: string) {
  let media: any;
  let privateMedia = false;
  function walk(value: any, depth = 0) {
    if (depth > 80) return;
    if (typeof value === "string" && /^[{[]/.test(value)) {
      try {
        walk(JSON.parse(value), depth + 1);
      } catch {}
      return;
    }
    if (!value || typeof value !== "object") return;
    const candidate =
      value.shortcode_media ||
      value.xdt_shortcode_media ||
      (value.shortcode === shortcode ? value : undefined);
    if (candidate?.shortcode === shortcode) {
      if (candidate.owner?.is_private) privateMedia = true;
      media = candidate;
    }
    for (const child of Object.values(value)) walk(child, depth + 1);
  }
  instagramPageData(html).forEach((v) => walk(v));
  return privateMedia ? undefined : media;
}
export function parseInstagramProfile(
  html: string,
  username: string,
  creatorId: string,
  selected: SyncType[],
) {
  const { user, media } = pageProfile(html, username);
  if (!user) throw userError("instagram.noPublicPosts");
  if (user.is_private) throw userError("instagram.privateAccount");
  if (!media.length && !Array.isArray(user.edge_owner_to_timeline_media?.edges))
    throw userError("instagram.embedNoPosts");
  return {
    posts: instagramPosts(media, username, creatorId, selected),
    media,
    avatar: mediaUrl(user.profile_pic_url_hd || user.profile_pic_url) || "",
    ...warningPair([notice("instagram.embedPreviewOnly")]),
  };
}
export async function syncInstagram(
  input: string,
  creatorId: string,
  selected: SyncType[],
) {
  const username = instagramUsername(input);
  if (!selected.length)
    return {
      posts: [],
      avatar: "",
      warning: undefined,
      warningNotices: undefined,
    };
  const token = process.env.INSTAGRAM_ACCESS_TOKEN,
    userId = process.env.INSTAGRAM_USER_ID;
  if (token || userId) {
    if (!token || !userId || !/^\d+$/.test(userId))
      throw userError("instagram.apiCredentialsMissing");
    const version = process.env.INSTAGRAM_GRAPH_VERSION;
    if (!version || !/^v\d+\.0$/.test(version))
      throw userError("instagram.apiVersionMissing");
    const fields = `business_discovery.username(${username}){username,profile_picture_url,media.limit(30){id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}}}`;
    const response = await fetch(
      `https://graph.facebook.com/${version}/${userId}?fields=${encodeURIComponent(fields)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      throw userError("instagram.apiUnavailable", { status: response.status });
    const data = (await response.json()) as any;
    const discovery = data.business_discovery;
    if (
      data.error ||
      discovery?.username?.toLowerCase() !== username ||
      !Array.isArray(discovery.media?.data)
    )
      throw userError("instagram.apiNoPosts");
    return {
      posts: instagramPosts(
        discovery.media.data,
        username,
        creatorId,
        selected,
      ),
      avatar: mediaUrl(discovery.profile_picture_url) || "",
      ...warningPair(
        discovery.media.paging?.next ? [notice("instagram.apiLatestOnly")] : [],
      ),
    };
  }
  const response = await fetch(`https://www.instagram.com/${username}/embed/`, {
    headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw userError("instagram.profileUnavailable", {
      status: response.status,
    });
  const result = parseInstagramProfile(
    await response.text(),
    username,
    creatorId,
    ["post", "video", "short"],
  );
  let detailFailed = false;
  if (selected.length) {
    for (let i = 0; i < Math.min(result.media.length, 6); i++) {
      const m = result.media[i];
      const hasVideo =
        m.is_video ||
        m.edge_sidecar_to_children?.edges?.some((e: any) => e.node?.is_video);
      if (
        !hasVideo ||
        m.owner?.username?.toLowerCase() !== username ||
        m.owner?.is_private ||
        !/^[a-zA-Z0-9_-]+$/.test(m.shortcode || "")
      )
        continue;
      if (
        m.is_video &&
        !selected.includes("video") &&
        !selected.includes("short")
      )
        continue;
      try {
        const detail = await fetch(
          `https://www.instagram.com/p/${m.shortcode}/embed/captioned/`,
          {
            headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(20000),
          },
        );
        if (!detail.ok) throw new Error("Unavailable embed");
        const enriched = pagePost(await detail.text(), m.shortcode);
        if (!enriched) throw new Error("Unavailable media");
        result.media[i] = { ...m, ...enriched, owner: m.owner };
      } catch {
        detailFailed = true;
      }
    }
  }
  return {
    ...result,
    posts: instagramPosts(result.media, username, creatorId, selected),
    ...warningPair([
      ...(result.warningNotices || []),
      ...(detailFailed ? [notice("instagram.videoDetailsUnavailable")] : []),
    ]),
  };
}

// Instagram CDN links are signed: `oe` is the hex Unix expiry, a few days out.
export function instagramMediaExpiry(url: string | undefined) {
  if (!url) return;
  try {
    const oe = new URL(url).searchParams.get("oe");
    if (oe && /^[0-9a-f]+$/i.test(oe)) return parseInt(oe, 16) * 1000;
  } catch {}
}
const staleWithinMs = 12 * 60 * 60 * 1000;
export function instagramMediaStale(
  post: Pick<Post, "image" | "images" | "videos">,
  now = Date.now(),
) {
  const urls = [
    post.image,
    ...(post.images || []),
    ...(post.videos || []).flatMap((v) => [v.url, v.poster]),
  ].filter((u): u is string => !!u);
  if (!urls.length) return true;
  return urls.some((u) => {
    const expiry = instagramMediaExpiry(u);
    return expiry === undefined || expiry - now < staleWithinMs;
  });
}
// Single-image posts carry no JSON in the post embed, only the rendered <img>.
export function embeddedImage(html: string) {
  const tag = html.match(/<img\b[^>]*\bclass="EmbeddedMediaImage"[^>]*>/i)?.[0];
  if (!tag) return;
  const attr = (name: string) =>
    tag
      .match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1]
      ?.replace(/&amp;/g, "&");
  const largest = attr("srcset")
    ?.split(",")
    .map((part) => part.trim().split(/\s+/))
    .filter(([u, w]) => u && /^\d+w$/.test(w || ""))
    .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0]?.[0];
  return mediaUrl(largest) || mediaUrl(attr("src"));
}
const failedRefreshes = new Map<string, number>();
// Re-reads the public post embed for a stored post when its media links are
// about to expire. The shortcode comes from the stored post id, never from input.
export async function refreshInstagramMedia(
  post: Post,
  now = Date.now(),
): Promise<Pick<Post, "image" | "images" | "videos"> | undefined> {
  const shortcode = post.id.match(/^instagram:([a-zA-Z0-9_-]+)$/)?.[1];
  if (!shortcode || !instagramMediaStale(post, now)) return;
  if ((failedRefreshes.get(post.id) || 0) > now) return;
  try {
    const response = await fetch(
      `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
      {
        headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw userError("instagram.postUnavailable", {
        status: response.status,
      });
    const html = await response.text();
    const media = pagePost(html, shortcode);
    if (media) {
      const fresh = instagramPosts(
        [{ ...media, owner: undefined, shortcode }],
        post.sourceUsername || "",
        post.creatorId,
        ["post", "video", "short"],
      )[0];
      if (fresh && (fresh.images?.length || fresh.videos?.length))
        return {
          image: fresh.image,
          images: fresh.images,
          videos: fresh.videos,
        };
    }
    const image = embeddedImage(html);
    if (!image) throw userError("instagram.postMediaMissing");
    return {
      image,
      images: [image, ...(post.images || []).slice(1)],
      videos: (post.videos || []).map((v, i) =>
        i === 0 ? { ...v, poster: image } : v,
      ),
    };
  } catch (error) {
    if (failedRefreshes.size > 500) failedRefreshes.clear();
    failedRefreshes.set(post.id, now + 5 * 60 * 1000);
    throw error;
  }
}
