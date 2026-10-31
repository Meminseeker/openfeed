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
  campaignId?: string;
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
// Sanitized rich text; rendered as React elements, never as HTML.
export interface RichSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
}
export type RichBlock =
  | { type: "paragraph" | "quote"; spans: RichSpan[] }
  | { type: "heading"; level: number; spans: RichSpan[] }
  | { type: "item"; ordered: boolean; spans: RichSpan[] }
  | { type: "image"; src: string; width?: number; height?: number }
  | { type: "rule" };
export interface Post {
  id: string;
  creatorId: string;
  title: string;
  text?: string;
  image?: string;
  images?: string[];
  videoId?: string;
  platform?: "youtube" | "x" | "instagram" | "tiktok" | "patreon";
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
  linkedAt?: string;
  playlistIds?: string[];
  removed?: boolean;
  textTruncated?: boolean;
  textExpanded?: boolean;
  textVersion?: number;
  blocks?: RichBlock[];
  locked?: boolean;
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
