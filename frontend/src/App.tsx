import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { AccountManager } from './components/AccountManager'
import { Feed } from './components/Feed'
import type { Account, Platform } from './types'
import { KIND_META, PLATFORM_META } from './utils'
import './App.css'

function App() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [kind, setKind] = useState('')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [group, setGroup] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [showManager, setShowManager] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(async () => {
    try {
      const [accs, grps] = await Promise.all([api.listAccounts(), api.listGroups()])
      setAccounts(accs)
      setGroups(grps)
    } catch {
      /* backend may still be starting */
    }
  }, [])

  useEffect(() => {
    void reload()
    const t = setInterval(() => void reload(), 60_000)
    return () => clearInterval(t)
  }, [reload])

  const onAccountsChanged = () => {
    void reload()
    setReloadKey((k) => k + 1)
  }

  const errorCount = accounts.filter((a) => a.fetch_status === 'error').length
  const selectedAccount = accountId !== null ? accounts.find((a) => a.id === accountId) : null

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo">openfeed</h1>

        <nav className="filters">
          <button className={platform === '' ? 'chip active' : 'chip'} onClick={() => setPlatform('')}>
            All
          </button>
          {Object.entries(PLATFORM_META).map(([key, meta]) => (
            <button
              key={key}
              className={platform === key ? 'chip active' : 'chip'}
              onClick={() => setPlatform(platform === key ? '' : (key as Platform))}
            >
              {meta.label}
              {meta.experimental && <span className="exp-badge">exp</span>}
            </button>
          ))}
          {groups.length > 0 && <span className="chip-sep" />}
          {groups.map((g) => (
            <button
              key={g}
              className={group === g ? 'chip active group' : 'chip group'}
              onClick={() => setGroup(group === g ? '' : g)}
            >
              #{g}
            </button>
          ))}
        </nav>

        <div className="filter-selects">
          <select
            className="filter-select"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            title="Filter by content kind"
          >
            <option value="">All kinds</option>
            {Object.entries(KIND_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}s
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value === '' ? null : Number(e.target.value))}
            title="Filter by source account"
          >
            <option value="">All sources</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name || a.handle} ({PLATFORM_META[a.platform]?.label})
              </option>
            ))}
          </select>

          {(kind || accountId !== null) && (
            <button
              className="chip clear-filters"
              onClick={() => {
                setKind('')
                setAccountId(null)
              }}
              title="Clear kind/source filters"
            >
              ✕ {selectedAccount ? selectedAccount.display_name : ''} {kind ? KIND_META[kind]?.label : ''}
            </button>
          )}
        </div>

        <button className="btn-accounts" onClick={() => setShowManager((s) => !s)}>
          Accounts ({accounts.length})
          {errorCount > 0 && <span className="error-pill">{errorCount}</span>}
        </button>
      </header>

      <div className="layout">
        <Feed
          platform={platform}
          kind={kind}
          accountId={accountId}
          group={group}
          accounts={accounts}
          reloadKey={reloadKey}
        />
        {showManager && (
          <AccountManager
            accounts={accounts}
            onChange={onAccountsChanged}
            onClose={() => setShowManager(false)}
          />
        )}
      </div>
    </div>
  )
}

export default App
