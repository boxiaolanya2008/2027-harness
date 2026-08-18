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
