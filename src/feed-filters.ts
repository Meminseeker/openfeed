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
