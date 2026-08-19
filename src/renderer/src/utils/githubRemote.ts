export function parseGithubRemote(remote: string): { owner: string; repo: string; fullName: string } | null {
  const value = String(remote || '').trim()
  if (!value) return null
  const match = value.match(/github\.com[:/]([^/]+)\/([^/#?\s]+)/i)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/i, '').replace(/\/+$/, '')
  if (!owner || !repo) return null
  return { owner, repo, fullName: `${owner}/${repo}` }
}
