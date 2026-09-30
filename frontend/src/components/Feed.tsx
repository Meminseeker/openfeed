import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { Account, FeedItem, Platform } from '../types'
import { FeedItemCard } from './FeedItem'
import { PlayerModal } from './PlayerModal'

interface Props {
  platform: Platform | ''
  kind: string
  accountId: number | null
  group: string
  accounts: Account[]
  reloadKey: number
}

export function Feed({ platform, kind, accountId, group, accounts, reloadKey }: Props) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const load = useCallback(
    async (before: string | null) => {
      setLoading(true)
      setError('')
      try {
        const resp = await api.getFeed({ platform, kind, accountId, group, before, limit: 30 })
        setItems((prev) => (before ? [...prev, ...resp.items] : resp.items))
        setCursor(resp.next_cursor)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load feed')
      } finally {
        setLoading(false)
      }
    },
    [platform, kind, accountId, group],
  )

  useEffect(() => {
    setItems([])
    setCursor(null)
    setOpenIndex(null)
    void load(null)
  }, [load, reloadKey])

  const avatarByAccount = new Map(accounts.map((a) => [a.id, a.avatar_url]))
  const openItem = openIndex !== null ? items[openIndex] : null

  return (
    <main className="feed">
      {items.map((item, idx) => (
        <FeedItemCard
          key={`${item.platform}-${item.platform_item_id}`}
          item={item}
          avatarUrl={avatarByAccount.get(item.account_id)}
          onOpen={() => setOpenIndex(idx)}
        />
      ))}

      {error && <div className="feed-error">⚠ {error}</div>}

      {!loading && items.length === 0 && !error && (
        <div className="feed-empty">
          <p>Nothing here for this filter combination.</p>
          <p>Try clearing filters, or add more accounts.</p>
        </div>
      )}

      {loading && <div className="feed-loading">Loading…</div>}

      {cursor && !loading && (
        <button className="btn-load-more" onClick={() => void load(cursor)}>
          Load more
        </button>
      )}

      {openItem && openIndex !== null && (
        <PlayerModal
          items={items}
          index={openIndex}
          onNavigate={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </main>
  )
}
