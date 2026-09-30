export type Platform = 'youtube' | 'tiktok' | 'x' | 'instagram'

export type ItemKind = 'video' | 'short' | 'live' | 'post' | 'image' | 'text'

export interface Account {
  id: number
  platform: Platform
  handle: string
  display_name: string
  avatar_url: string
  profile_url: string
  group_tag: string
  last_fetched_at: string | null
  fetch_status: 'ok' | 'error' | 'pending' | 'disabled'
  fetch_error: string
  created_at: string
}

export interface FeedItem {
  id: number
  platform: Platform
  platform_item_id: string
  type: ItemKind
  title: string
  description: string
  thumbnail_url: string
  media_ref: string
  url: string
  author_name: string
  published_at: string | null
  account_id: number
}

export interface FeedResponse {
  items: FeedItem[]
  next_cursor: string | null
}

export interface RefreshResult {
  account_id: number
  platform: string
  new_items: number
  status: string
  error: string
}
