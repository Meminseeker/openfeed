export function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'
  const mins = Math.floor(diffSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export const PLATFORM_META: Record<string, { label: string; color: string; experimental?: boolean }> = {
  youtube: { label: 'YouTube', color: '#ff0033' },
  tiktok: { label: 'TikTok', color: '#25f4ee' },
  x: { label: 'X', color: '#e7e9ea', experimental: true },
  instagram: { label: 'Instagram', color: '#e1306c', experimental: true },
}

export const KIND_META: Record<string, { label: string; color: string }> = {
  video: { label: 'Video', color: '#4f8ef7' },
  short: { label: 'Short', color: '#a26bf5' },
  live: { label: 'Live', color: '#f7544f' },
  post: { label: 'Post', color: '#3fb950' },
  image: { label: 'Image', color: '#3fb950' },
  text: { label: 'Text', color: '#8b93a1' },
}

/** Items that can be played inline in the player modal. */
export function isPlayable(item: { platform: string; type: string }): boolean {
  if (item.platform === 'youtube') return item.type === 'video' || item.type === 'short' || item.type === 'live'
  if (item.platform === 'tiktok') return item.type === 'video'
  return false
}
