export type Kind = "video" | "short" | "community" | "post";
export type SyncType = Kind | "repost";
export const sourceTypes: Record<string, SyncType[]> = {
  youtube: ["video", "short", "community"],
  x: ["post", "repost"],
  instagram: ["post", "video", "short"],
  tiktok: ["video"],
  patreon: ["post"],
};
export const syncLabels: Record<SyncType, string> = {
  video: "Videos",
  short: "Shorts",
  community: "Community posts",
  post: "Posts",
  repost: "Reposts",
};
export function enabledTypes(account: Account): SyncType[] {
  return (
    account.syncTypes ??
    (account.platform === "x" ? ["post"] : sourceTypes[account.platform]) ??
    []
  );
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
  libraryOnly?: boolean;
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
  platform?: "youtube" | "x" | "instagram" | "tiktok";
  sourceUsername?: string;
  videos?: { url: string; poster?: string; loop?: boolean }[];
  repost?: boolean;
  notes?: string;
  url: string;
  kind: Kind;
  published: string;
  publishedApproximate?: boolean;
  duration?: string;
  libraryOnly?: boolean;
  linked?: boolean;
  playlistIds?: string[];
  removed?: boolean;
  textTruncated?: boolean;
  textExpanded?: boolean;
  textVersion?: number;
  read: boolean;
  saved: boolean;
}
export interface State {
  playlists?: Playlist[];
  creators: Creator[];
  posts: Post[];
}

export interface Playlist {
  id: string;
  title: string;
  url: string;
  postIds: string[];
  warning?: string;
}
