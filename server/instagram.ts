import type { Post, SyncType } from "../src/types.ts";

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
      throw new Error("Use an Instagram username or HTTPS profile URL.");
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
    throw new Error(
      "Enter a valid Instagram profile username (up to 30 characters).",
    );
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
  if (!user)
    throw new Error(
      "Instagram did not expose public posts. The profile may be private, have embeds disabled, or require sign-in. No authenticated access is attempted.",
    );
  if (user.is_private)
    throw new Error("Private Instagram accounts are not supported.");
  if (!media.length && !Array.isArray(user.edge_owner_to_timeline_media?.edges))
    throw new Error(
      "Instagram's public profile embed did not expose any posts.",
    );
  return {
    posts: instagramPosts(media, username, creatorId, selected),
    media,
    avatar: mediaUrl(user.profile_pic_url_hd || user.profile_pic_url) || "",
    warning:
      "Instagram profile embeds expose only a small recent preview (usually 6 posts); a complete timeline is not guaranteed.",
  };
}
export async function syncInstagram(
  input: string,
  creatorId: string,
  selected: SyncType[],
) {
  const username = instagramUsername(input);
  if (!selected.length) return { posts: [], avatar: "", warning: undefined };
  const token = process.env.INSTAGRAM_ACCESS_TOKEN,
    userId = process.env.INSTAGRAM_USER_ID;
  if (token || userId) {
    if (!token || !userId || !/^\d+$/.test(userId))
      throw new Error(
        "Set both INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID for Meta Business Discovery.",
      );
    const version = process.env.INSTAGRAM_GRAPH_VERSION;
    if (!version || !/^v\d+\.0$/.test(version))
      throw new Error(
        "Set INSTAGRAM_GRAPH_VERSION to the Graph API version configured for your Meta app (for example v24.0).",
      );
    const fields = `business_discovery.username(${username}){username,profile_picture_url,media.limit(30){id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}}}`;
    const response = await fetch(
      `https://graph.facebook.com/${version}/${userId}?fields=${encodeURIComponent(fields)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Instagram API unavailable (HTTP ${response.status}). Check Meta permissions, token and public professional account eligibility.`,
      );
    const data = (await response.json()) as any;
    const discovery = data.business_discovery;
    if (
      data.error ||
      discovery?.username?.toLowerCase() !== username ||
      !Array.isArray(discovery.media?.data)
    )
      throw new Error(
        "Meta did not return this account's public posts. Only eligible public Business/Creator accounts are supported.",
      );
    return {
      posts: instagramPosts(
        discovery.media.data,
        username,
        creatorId,
        selected,
      ),
      avatar: mediaUrl(discovery.profile_picture_url) || "",
      warning: discovery.media.paging?.next
        ? "Instagram imports the latest 30 items only; there is no archive backfill."
        : undefined,
    };
  }
  const response = await fetch(`https://www.instagram.com/${username}/embed/`, {
    headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      `Instagram public profile unavailable (HTTP ${response.status}).`,
    );
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
    warning:
      result.warning +
      (detailFailed
        ? " Some video details were unavailable; use Open source."
        : ""),
  };
}
