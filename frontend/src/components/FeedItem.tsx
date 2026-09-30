import { useState } from 'react'
import { thumbUrl } from '../api'
import type { FeedItem } from '../types'
import { isPlayable, KIND_META, PLATFORM_META, relativeTime } from '../utils'

interface Props {
  item: FeedItem
  avatarUrl?: string
  onOpen: (item: FeedItem) => void
}

export function FeedItemCard({ item, avatarUrl, onOpen }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const meta = PLATFORM_META[item.platform] ?? { label: item.platform, color: '#888' }
  const kind = KIND_META[item.type]
  const playable = isPlayable(item)
  // Instagram CDN rejects hotlinks; route its images through the backend proxy.
  const thumb =
    item.platform === 'instagram' && item.thumbnail_url
      ? thumbUrl(item.thumbnail_url)
      : item.thumbnail_url
  const showKindBadge = item.type !== 'video' && kind
  // Posts carry their full text in description (title is a truncation of it).
  const bodyText = item.type === 'post' ? item.description || item.title : item.title
  const portrait = item.type === 'short' || item.platform === 'tiktok'

  return (
    <article className="card" data-kind={item.type}>
      <header className="card-header">
        {avatarUrl ? (
          <img className="avatar" src={avatarUrl} alt="" loading="lazy" />
        ) : (
          <span className="avatar avatar-fallback">{item.author_name.slice(0, 1)}</span>
        )}
        <div className="card-author">
          <span className="author-name">{item.author_name}</span>
          <span className="card-sub">
            <span className="platform-badge" style={{ backgroundColor: meta.color }}>
              {meta.label}
            </span>
            {showKindBadge && (
              <span className="kind-badge" style={{ color: kind.color, borderColor: kind.color }}>
                {kind.label}
              </span>
            )}
            {meta.experimental && <span className="exp-badge">experimental</span>}
            <time>{relativeTime(item.published_at)}</time>
          </span>
        </div>
        <a className="link-out" href={item.url} target="_blank" rel="noreferrer" title="Open original">
          ↗
        </a>
      </header>

      {bodyText && <p className="card-title">{bodyText}</p>}

      {(item.type === 'video' || item.type === 'short' || item.type === 'live') &&
        thumb &&
        !imgFailed && (
          <button
            className={`thumb-wrap ${portrait ? 'portrait' : ''}`}
            onClick={() => playable && onOpen(item)}
            title={playable ? 'Play' : 'Video (open original to watch)'}
          >
            <img src={thumb} alt="" loading="lazy" onError={() => setImgFailed(true)} />
            {playable && <span className="play-overlay">▶</span>}
            {item.type === 'live' && <span className="live-corner">LIVE</span>}
          </button>
        )}

      {(item.type === 'image' || item.type === 'post') && thumb && !imgFailed && (
        <button className="thumb-wrap static" onClick={() => onOpen(item)} title="View">
          <img src={thumb} alt="" loading="lazy" onError={() => setImgFailed(true)} />
        </button>
      )}

      {item.type === 'text' && item.description && item.description !== item.title && (
        <p className="card-desc">{item.description}</p>
      )}
    </article>
  )
}
