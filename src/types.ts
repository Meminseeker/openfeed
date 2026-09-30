export type Kind = "video" | "short" | "community";
export interface Account {
  platform: string;
  username: string;
  channelId?: string;
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
