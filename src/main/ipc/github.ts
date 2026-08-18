import { getSecret } from '../security'

// GitHub REST v3 代理，token 只存在主进程，避免 CORS 与泄露
export async function gh(path: string, init: RequestInit = {}): Promise<any> {
  const token = getSecret('githubToken')
  if (!token) throw new Error('未配置 GitHub token')
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers as Record<string, string>)
  }
  if (init.body) headers['Content-Type'] = 'application/json'
  headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`https://api.github.com${path}`, { ...init, headers })
  if (res.status === 401) throw new Error('GitHub token 无效或已过期')
  if (res.status === 403) throw new Error('GitHub 限流或权限不足')
  if (res.status === 404) throw new Error('资源不存在')
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub 请求失败 (${res.status}): ${body.slice(0, 300)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function ghPaginate(path: string, perPage = 30): Promise<any[]> {
  const items: any[] = []
  let page = 1
  for (;;) {
    const sep = path.includes('?') ? '&' : '?'
    const batch = await gh(`${path}${sep}per_page=${perPage}&page=${page}`)
    items.push(...batch)
    if (batch.length < perPage) break
    page++
    if (page > 10) break
  }
  return items
}
