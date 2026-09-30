import { useState } from 'react'
import { api } from '../api'
import type { Account } from '../types'
import { PLATFORM_META, relativeTime } from '../utils'

interface Props {
  accounts: Account[]
  onChange: () => void
  onClose: () => void
}

export function AccountManager({ accounts, onChange, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [group, setGroup] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState<number | null>(null)

  const add = async () => {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.addAccount(url.trim(), group.trim())
      setUrl('')
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add account')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    await api.deleteAccount(id)
    onChange()
  }

  const refresh = async (id: number) => {
    setRefreshing(id)
    try {
      await api.refreshAccount(id)
    } finally {
      setRefreshing(null)
      onChange()
    }
  }

  const setGroupTag = async (id: number, tag: string) => {
    await api.updateAccount(id, { group_tag: tag })
    onChange()
  }

  return (
    <aside className="manager">
      <div className="manager-header">
        <h2>Accounts</h2>
        <button className="btn-icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="add-form">
        <input
          type="text"
          placeholder="Profile URL, e.g. youtube.com/@mkbhd"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <input
          type="text"
          className="group-input"
          placeholder="Group (optional, e.g. ev)"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
        <button className="btn-primary" onClick={() => void add()} disabled={busy || !url.trim()}>
          {busy ? 'Adding…' : 'Add'}
        </button>
        {error && <p className="form-error">{error}</p>}
        <p className="form-hint">
          YouTube &amp; TikTok work out of the box. X/Instagram need RSSHub running (see README).
        </p>
      </div>

      <ul className="account-list">
        {accounts.map((a) => {
          const meta = PLATFORM_META[a.platform]
          return (
            <li key={a.id} className="account-row">
              <span
                className={`status-dot ${a.fetch_status}`}
                title={a.fetch_status === 'error' ? a.fetch_error : a.fetch_status}
              />
              <div className="account-info">
                <div className="account-name">
                  {a.display_name || a.handle}
                  {meta?.experimental && <span className="exp-badge">exp</span>}
                </div>
                <div className="account-meta">
                  <span style={{ color: meta?.color }}>{meta?.label}</span>
                  {a.last_fetched_at && <span> · {relativeTime(a.last_fetched_at)}</span>}
                </div>
                {a.fetch_status === 'error' && (
                  <div className="account-error" title={a.fetch_error}>
                    {a.fetch_error.slice(0, 120)}
                  </div>
                )}
                <input
                  className="tag-input"
                  defaultValue={a.group_tag}
                  placeholder="+ group tag"
                  onBlur={(e) => {
                    if (e.target.value !== a.group_tag) void setGroupTag(a.id, e.target.value)
                  }}
                />
              </div>
              <div className="account-actions">
                <button
                  className="btn-icon"
                  title="Refresh now"
                  disabled={refreshing === a.id}
                  onClick={() => void refresh(a.id)}
                >
                  {refreshing === a.id ? '…' : '↻'}
                </button>
                <button className="btn-icon danger" title="Remove" onClick={() => void remove(a.id)}>
                  🗑
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
