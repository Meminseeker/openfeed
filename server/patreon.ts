import type { Post, RichBlock, RichSpan } from "../src/types.ts";

// Patreon has no public creator-posts API. This reads the web app's JSON:API
// endpoints; member-only content requires the owner's browser session cookie.
const api = "https://www.patreon.com/api";
const reserved = [
  "api",
  "c",
  "checkout",
  "cw",
  "explore",
  "home",
  "join",
  "login",
  "messages",
  "notifications",
  "posts",
  "settings",
  "signup",
];
const pageSize = 20;
const pageLimit = 10;

export function patreonUsername(input: string) {
  let value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["www.patreon.com", "patreon.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("Use a Patreon username or HTTPS profile URL.");
    const match = url.pathname.match(/^\/(?:(?:c|cw)\/)?([^/]+)\/?$/);
    if (!match) throw new Error("Use a Patreon creator URL, not a post URL.");
    value = match[1];
  }
  value = value.replace(/^@/, "");
  if (
    !/^[a-zA-Z0-9_-]{1,64}$/.test(value) ||
    reserved.includes(value.toLowerCase())
  )
    throw new Error("Enter a valid Patreon creator username.");
  return value.toLowerCase();
}

function session(useSession: boolean) {
  const id = useSession ? process.env.PATREON_SESSION_ID?.trim() : "";
  return id && /^[\w.%-]+$/.test(id) ? id : "";
}
async function patreonJson(url: string, sessionId = ""): Promise<any> {
  const r = await fetch(url, {
    headers: {
      Accept: "application/vnd.api+json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      ...(sessionId ? { Cookie: `session_id=${sessionId}` } : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok || !/json/.test(r.headers.get("content-type") || ""))
    throw new Error(
      `Patreon blocked or unavailable (HTTP ${r.status}). Existing posts are kept.`,
    );
  return r.json();
}

function patreonMedia(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.endsWith(".patreonusercontent.com")
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
function link(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export async function resolvePatreonCampaign(input: string) {
  const username = patreonUsername(input);
  const params = new URLSearchParams({
    "filter[vanity]": username,
    "fields[campaign]": "vanity,name,avatar_photo_url",
    "json-api-version": "1.0",
  });
  const data = await patreonJson(`${api}/campaigns?${params}`);
  const campaign = (Array.isArray(data?.data) ? data.data : []).find(
    (c: any) =>
      c?.type === "campaign" &&
      /^\d+$/.test(String(c.id)) &&
      String(c.attributes?.vanity || "").toLowerCase() === username,
  );
  if (!campaign) throw new Error("Patreon creator not found.");
  return {
    id: String(campaign.id),
    name: String(campaign.attributes.name || username),
    avatar: patreonMedia(campaign.attributes.avatar_photo_url) || "",
  };
}

// Converts Patreon's TipTap document JSON into sanitized blocks and plain text.
export function patreonDoc(json: unknown) {
  let doc: any;
  try {
    doc = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    return { blocks: [] as RichBlock[], text: "" };
  }
  const blocks: RichBlock[] = [];
  const spans = (node: any): RichSpan[] => {
    const out: RichSpan[] = [];
    const visit = (n: any, depth: number) => {
      if (!n || typeof n !== "object" || depth > 40) return;
      if (n.type === "hardBreak") {
        if (out.length) out[out.length - 1].text += "\n";
        else out.push({ text: "\n" });
        return;
      }
      if (n.type === "text" && typeof n.text === "string") {
        const span: RichSpan = { text: n.text };
        for (const mark of Array.isArray(n.marks) ? n.marks : []) {
          if (mark?.type === "bold") span.bold = true;
          else if (mark?.type === "italic") span.italic = true;
          else if (mark?.type === "underline") span.underline = true;
          else if (mark?.type === "link") {
            const href = link(mark.attrs?.href);
            if (href) span.href = href;
          }
        }
        out.push(span);
        return;
      }
      for (const child of Array.isArray(n.content) ? n.content : [])
        visit(child, depth + 1);
    };
    visit(node, 0);
    return out;
  };
  const text = (s: RichSpan[]) =>
    s
      .map((x) => x.text)
      .join("")
      .trim();
  const walk = (node: any, depth: number, ordered?: boolean) => {
    if (!node || typeof node !== "object" || depth > 40) return;
    switch (node.type) {
      case "paragraph": {
        const s = spans(node);
        if (text(s)) blocks.push({ type: "paragraph", spans: s });
        return;
      }
      case "heading": {
        const s = spans(node);
        const level = Number(node.attrs?.level);
        if (text(s))
          blocks.push({
            type: "heading",
            level: level >= 1 && level <= 6 ? level : 3,
            spans: s,
          });
        return;
      }
      case "blockquote": {
        const s = spans(node);
        if (text(s)) blocks.push({ type: "quote", spans: s });
        return;
      }
      case "bulletList":
      case "orderedList":
        for (const child of Array.isArray(node.content) ? node.content : [])
          walk(child, depth + 1, node.type === "orderedList");
        return;
      case "listItem": {
        const s = spans(node);
        if (text(s))
          blocks.push({ type: "item", ordered: !!ordered, spans: s });
        return;
      }
      case "image": {
        const src = patreonMedia(node.attrs?.src);
        const width = Number(node.attrs?.media_width);
        const height = Number(node.attrs?.media_height);
        if (src)
          blocks.push({
            type: "image",
            src,
            ...(width > 0 && height > 0 ? { width, height } : {}),
          });
        return;
      }
      case "horizontalRule":
        blocks.push({ type: "rule" });
        return;
      case "doc":
        for (const child of Array.isArray(node.content) ? node.content : [])
          walk(child, depth + 1);
        return;
      default: {
        const s = spans(node);
        if (text(s)) blocks.push({ type: "paragraph", spans: s });
      }
    }
  };
  walk(doc, 0);
  return {
    blocks,
    text: blocks
      .map((b) =>
        b.type === "item"
          ? `• ${text(b.spans)}`
          : "spans" in b
            ? text(b.spans)
            : "",
      )
      .filter(Boolean)
      .join("\n\n"),
  };
}

function youtubeId(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www|m)\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : host === "youtube.com"
          ? url.pathname === "/watch"
            ? url.searchParams.get("v")
            : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1]
          : undefined;
    return id && /^[\w-]{11}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function patreonPost(
  item: any,
  username: string,
  creatorId: string,
): Post | undefined {
  const a = item?.attributes;
  if (
    item?.type !== "post" ||
    !/^\d+$/.test(String(item.id)) ||
    !a ||
    a.was_posted_by_campaign_owner === false
  )
    return;
  const locked = a.current_user_can_view !== true;
  const body = patreonDoc(
    locked ? a.teaser_text_json_string : a.content_json_string,
  );
  const published = Date.parse(a.published_at);
  const url = link(a.url);
  const videoId = youtubeId(a.embed?.url);
  const title =
    String(a.title || "").trim() ||
    body.text.split("\n")[0].slice(0, 160) ||
    "Patreon post";
  return {
    id: `patreon:${item.id}`,
    creatorId,
    title: title.slice(0, 300),
    text: body.text,
    ...(locked || !body.blocks.length ? {} : { blocks: body.blocks }),
    ...(locked ? { locked: true } : {}),
    image:
      patreonMedia(a.image?.large_url) ||
      patreonMedia(a.image?.url) ||
      patreonMedia(a.thumbnail?.default) ||
      patreonMedia(a.thumbnail?.original) ||
      (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined),
    videoId,
    platform: "patreon",
    sourceUsername: username,
    url:
      url && new URL(url).hostname.endsWith("patreon.com")
        ? url
        : `https://www.patreon.com/posts/${item.id}`,
    kind: "post",
    published: Number.isFinite(published)
      ? new Date(published).toISOString()
      : "",
    read: false,
    saved: false,
  };
}

const postFields =
  "title,content_json_string,teaser_text_json_string,published_at,url,embed,image,thumbnail,current_user_can_view,was_posted_by_campaign_owner";
function nextPage(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.origin === "https://www.patreon.com" &&
      url.pathname === "/api/posts"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export async function syncPatreon(
  input: string,
  campaignId: string,
  creatorId: string,
  options: { useSession: boolean; since: number },
) {
  const username = patreonUsername(input);
  if (!/^\d+$/.test(campaignId))
    throw new Error("Patreon campaign could not be resolved.");
  const sessionId = session(options.useSession);
  const params = new URLSearchParams({
    "filter[campaign_id]": campaignId,
    "filter[contains_exclusive_posts]": "true",
    "filter[is_draft]": "false",
    sort: "-published_at",
    "page[count]": String(pageSize),
    "fields[post]": postFields,
    "json-api-version": "1.0",
    "json-api-use-default-includes": "false",
  });
  let url: string | undefined = `${api}/posts?${params}`;
  const posts: Post[] = [];
  let pages = 0;
  let older = false;
  while (url && pages < pageLimit && !older) {
    const data = await patreonJson(url, sessionId);
    pages++;
    for (const item of Array.isArray(data?.data) ? data.data : []) {
      const post = patreonPost(item, username, creatorId);
      if (!post) continue;
      if (post.published && Date.parse(post.published) < options.since) {
        older = true;
        break;
      }
      posts.push(post);
    }
    url = nextPage(data?.links?.next);
  }
  const warnings: string[] = [];
  if (!sessionId)
    warnings.push(
      "Showing public Patreon previews only; member posts are locked.",
    );
  else if (posts.length && posts.every((p) => p.locked))
    warnings.push(
      "Patreon session expired or this membership does not unlock these posts. Update PATREON_SESSION_ID.",
    );
  if (url && !older)
    warnings.push(
      `Only the newest ${pageLimit * pageSize} Patreon posts were checked.`,
    );
  return { posts, warning: warnings.join(" ") || undefined };
}

const postRequests = new Map<string, { until: number; post?: Post }>();
export async function fetchPatreonPost(post: Post, useSession: boolean) {
  const id = post.id.match(/^patreon:(\d+)$/)?.[1];
  if (post.platform !== "patreon" || !id) return post;
  const key = `${useSession ? "s" : "p"}:${id}`;
  const cached = postRequests.get(key);
  let fresh = cached && cached.until > Date.now() ? cached.post : undefined;
  if (!fresh) {
    const params = new URLSearchParams({
      "fields[post]": postFields,
      "json-api-version": "1.0",
      "json-api-use-default-includes": "false",
    });
    const data = await patreonJson(
      `${api}/posts/${id}?${params}`,
      session(useSession),
    );
    if (String(data?.data?.id) !== id)
      throw new Error("Patreon did not return this post.");
    fresh = patreonPost(data.data, post.sourceUsername || "", post.creatorId);
    if (!fresh) throw new Error("Patreon did not return this post.");
    if (postRequests.size > 500) postRequests.clear();
    postRequests.set(key, { until: Date.now() + 300000, post: fresh });
  }
  return {
    ...post,
    title: fresh.title,
    text: fresh.text,
    blocks: fresh.blocks,
    locked: fresh.locked,
    image: fresh.image,
    videoId: fresh.videoId,
  };
}
