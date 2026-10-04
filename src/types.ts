export type Kind = "video" | "short" | "community" | "post";
export type SyncType = Kind | "post";
export const sourceTypes: Record<string, SyncType[]> = {
  youtube: ["video", "short", "community"],
  x: ["post"],
  instagram: ["post", "video", "short"],
  tiktok: ["video"],
  patreon: ["post"],
};
export const syncLabels: Record<SyncType, string> = {
  video: "Videos",
  short: "Shorts",
  community: "Community posts",
  post: "Posts",
};
export function enabledTypes(account: Account): SyncType[] {
  return account.syncTypes ?? sourceTypes[account.platform] ?? [];
}
export interface Account {
  platform: string;
  username: string;
  channelId?: string;
  syncTypes?: SyncType[];
  xSinceId?: string;
  lastSync?: string;
  error?: string;
}
export interface Creator {
  id: string;
  name: string;
  tags: string[];
  accounts: Account[];
  avatar: string;
  lastSync?: string;
  error?: string;
}
export interface Post {
  id: string;
  creatorId: string;
  title: string;
  text?: string;
  image?: string;
  images?: string[];
  videoId?: string;
  platform?: "youtube" | "x" | "instagram";
  sourceUsername?: string;
  videos?: { url: string; poster?: string; loop?: boolean }[];
  repost?: boolean;
  notes?: string;
  url: string;
  kind: Kind;
  published: string;
  publishedApproximate?: boolean;
  duration?: string;
  read: boolean;
  saved: boolean;
}
export interface State {
  creators: Creator[];
  posts: Post[];
}
