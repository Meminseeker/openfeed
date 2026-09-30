import { useCallback, useEffect } from 'react'
import { tiktokStreamUrl, thumbUrl } from '../api'
import type { FeedItem } from '../types'
import { isPlayable, KIND_META, PLATFORM_META } from '../utils'

interface Props {
  items: FeedItem[]
  index: number
  onNavigate: (index: number) => void
  onClose: () => void
}

/**
 * Content viewer / player modal.
 * Navigate with the side buttons or ArrowLeft/ArrowRight; close with Esc or backdrop.
 */
export function PlayerModal({ items, index, onNavigate, onClose }: Props) {
  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(index - 1)
  }, [hasPrev, index, onNavigate])
  const goNext = useCallback(() => {
    if (hasNext) onNavigate(index + 1)
  }, [hasNext, index, onNavigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  if (!item) return null

  const meta = PLATFORM_META[item.platform]
  const kind = KIND_META[item.type]
  const playable = isPlayable(item)
  const portrait = item.type === 'short' || item.platform === 'tiktok'
  const thumb =
    item.platform === 'instagram' && item.thumbnail_url
      ? thumbUrl(item.thumbnail_url)
      : item.thumbnail_url

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <button
        className="modal-nav prev"
        onClick={(e) => {
          e.stopPropagation()
          goPrev()
        }}
        disabled={!hasPrev}
        aria-label="Previous"
        title="Previous (Left arrow)"
      >
        ‹
      </button>
      <div className="modal-player" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" title={item.title || item.description}>
            {item.title || item.description || item.author_name}
          </span>
          {kind && item.type !== 'video' && (
            <span className="kind-badge" style={{ color: kind.color, borderColor: kind.color }}>
              {kind.label}
            </span>
          )}
          <span className="modal-pos">
            {index + 1} / {items.length}
          </span>
          <button className="btn-icon" onClick={onClose} aria-label="Close" title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className={`modal-body ${portrait && playable ? 'portrait' : ''}`}>
          {playable && item.platform === 'youtube' && (
            <iframe
              key={item.media_ref}
              src={`https://www.youtube-nocookie.com/embed/${item.media_ref}?autoplay=1&rel=0`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          {playable && item.platform === 'tiktok' && (
            <video key={item.id} src={tiktokStreamUrl(item.id)} controls autoPlay playsInline />
          )}

          {!playable && (
            <div className="modal-post">
              {thumb && <img src={thumb} alt="" />}
              {(item.description || item.title) && (
                <p className="modal-post-text">{item.description || item.title}</p>
              )}
              <div className="modal-post-meta">
                <span>{item.author_name}</span>
                {meta && <span style={{ color: meta.color }}>{meta.label}</span>}
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open original ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        className="modal-nav next"
        onClick={(e) => {
          e.stopPropagation()
          goNext()
        }}
        disabled={!hasNext}
        aria-label="Next"
        title="Next (Right arrow)"
      >
        ›
      </button>
    </div>
  )
}
