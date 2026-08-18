import { execFile } from 'node:child_process'

// 跑任意命令，流式回传 stdout/stderr（Agent 执行工具用）
export function runCommand(
  cwd: string,
  command: string,
  args: string[],
  onData: (chunk: string) => void
): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const child = execFile(command, args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err) => {
      resolve({ code: err ? (err as any).code ?? 1 : 0 })
    })
    child.stdout?.on('data', (d) => onData(d.toString()))
    child.stderr?.on('data', (d) => onData(d.toString()))
  })
}
