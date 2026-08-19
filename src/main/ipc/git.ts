import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024
  })
  return stdout.trim()
}

export async function runGitStreaming(args: string[], cwd: string, onData: (chunk: string) => void) {
  return new Promise<void>((resolve, reject) => {
    const child = execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err) => {
      if (err) reject(err)
      else resolve()
    })
    child.stdout?.on('data', (d) => onData(d.toString()))
    child.stderr?.on('data', (d) => onData(d.toString()))
  })
}

export interface GitCommit {
  sha: string
  author: string
  email: string
  date: string
  subject: string
}

export function parseGitLog(rawLog: string): GitCommit[] {
  return String(rawLog || '')
    .split('\x1e')
    .map((record) => record.replace(/^\n+/, '').trimEnd())
    .filter(Boolean)
    .map((record) => {
      const [sha, author, email, date, subject] = record.split('\x1f')
      return {
        sha: (sha || '').trim(),
        author: author || '',
        email: email || '',
        date: date || '',
        subject: subject || ''
      }
    })
    .filter((commit) => commit.sha && commit.date)
}

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
