import type { Account, FeedResponse, Platform, RefreshResult } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`
    try {
      const body = await resp.json()
      if (body?.detail) detail = body.detail
    } catch {
      /* keep default */
    }
    throw new Error(detail)
  }
  if (resp.status === 204) return undefined as T
  return resp.json() as Promise<T>
}

export const api = {
  listAccounts: () => request<Account[]>('/api/accounts'),

  addAccount: (url: string, groupTag = '') =>
    request<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ url, group_tag: groupTag }),
    }),

  updateAccount: (id: number, patch: { group_tag?: string; display_name?: string }) =>
    request<Account>(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteAccount: (id: number) => request<void>(`/api/accounts/${id}`, { method: 'DELETE' }),

  refreshAccount: (id: number) =>
    request<RefreshResult>(`/api/accounts/${id}/refresh`, { method: 'POST' }),

  getFeed: (opts: {
    platform?: Platform | ''
    accountId?: number | null
    kind?: string
    group?: string
    before?: string | null
    limit?: number
  }) => {
    const params = new URLSearchParams()
    if (opts.platform) params.set('platform', opts.platform)
    if (opts.accountId) params.set('account_id', String(opts.accountId))
    if (opts.kind) params.set('kind', opts.kind)
    if (opts.group) params.set('group', opts.group)
    if (opts.before) params.set('before', opts.before)
    if (opts.limit) params.set('limit', String(opts.limit))
    return request<FeedResponse>(`/api/feed?${params.toString()}`)
  },

  listGroups: () => request<string[]>('/api/feed/groups'),
}

export function tiktokStreamUrl(itemId: number): string {
  return `/api/media/tiktok/${itemId}/stream`
}

export function thumbUrl(url: string): string {
  return `/api/media/thumb?url=${encodeURIComponent(url)}`
}
