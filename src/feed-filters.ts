import type { Creator, Post } from "./types";
export const contentFilters = [
  ["youtube:video", "YT videos"],
  ["youtube:short", "YT Shorts"],
  ["youtube:community", "YT community"],
  ["x:post", "X posts / reposts"],
  ["instagram:post", "IG posts / albums"],
  ["instagram:video", "IG videos"],
  ["instagram:short", "IG Reels"],
  ["tiktok:video", "TikTok videos"],
] as const;
export function contentFilterKey(post: Post) {
  return `${post.platform || "youtube"}:${post.kind}`;
}
export function topicCreators(creators: Creator[], topic: string) {
  return creators.filter(
    (c) => topic === "All topics" || c.tags.includes(topic),
  );
}
export function eligibleSelection(selection: string[], creators: Creator[]) {
  const ids = new Set(creators.map((c) => c.id));
  return selection.filter((id) => ids.has(id));
}

export const timeRanges = ["All", "1d", "2d", "3d", "5d", "1w", "1w+"] as const;
export type TimeRange = (typeof timeRanges)[number];
export function inTimeRange(post: Post, range: TimeRange, now = Date.now()) {
  if (range === "All") return true;
  const date = Date.parse(post.published);
  if (!Number.isFinite(date)) return false;
  const age = Math.max(0, now - date) / 86400000;
  return range === "1w+"
    ? age > 7
    : age <= (range === "1w" ? 7 : Number(range[0]));
}
export function selectedCreators(
  selection: string[] | null,
  creators: Creator[],
) {
  return selection === null
    ? creators.map((c) => c.id)
    : eligibleSelection(selection, creators);
}

export interface FeedSelection {
  page: string;
  tag: string;
  query: string;
  types: string[];
  selection: string[];
  timeRange: TimeRange;
  unread: boolean;
  readStatus?: "all" | "unread" | "read";
  allCreators: boolean;
}
export function matchesFeedFilters(
  post: Post,
  creators: Creator[],
  filters: FeedSelection,
  ignoreType = false,
) {
  const creator = creators.find((c) => c.id === post.creatorId);
  return (
    !!creator &&
    (filters.page !== "feed" || !post.libraryOnly) &&
    (filters.page !== "saved" || post.saved) &&
    (filters.page !== "noted" || !!post.notes?.trim()) &&
    (filters.tag === "All topics" || creator.tags.includes(filters.tag)) &&
    (ignoreType ||
      !filters.types.length ||
      filters.types.includes(contentFilterKey(post))) &&
    (filters.selection.includes(creator.id) ||
      (filters.page !== "feed" &&
        creator.libraryOnly &&
        filters.allCreators)) &&
    inTimeRange(post, filters.timeRange) &&
    (filters.readStatus === "read"
      ? post.read
      : !(filters.readStatus === "unread" || filters.unread) || !post.read) &&
    `${post.title} ${post.text || ""} ${creator.name}`
      .toLowerCase()
      .includes(filters.query.toLowerCase())
  );
}
