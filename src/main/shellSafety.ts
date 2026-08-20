export type RiskLevel = 'safe' | 'risky' | 'critical'

export interface ShellRiskAssessment {
  level: RiskLevel
  reason: string
  matched: string
  suggestion: string
  patternId: string
}

interface Pattern {
  id: string
  level: RiskLevel
  reason: string
  suggestion: string
  test: RegExp
}

const CRITICAL_PATTERNS: Pattern[] = [
  {
    id: 'rm-root',
    level: 'critical',
    reason: '尝试删除系统根目录或用户主目录',
    suggestion: '请检查路径是否正确，避免使用 rm -rf /、~ 或 $HOME 等危险目标',
    test: /\brm\s+[^;|&]*-[a-z]*r[a-z]*f[^;|&]*(?:\s\/\s|\s\/$|\s\/\*|\s~(?:\/|\s|$)|\s\$HOME|\s%USERPROFILE%|\s\/\*)/i,
  },
  {
    id: 'rm-root-simple',
    level: 'critical',
    reason: '递归强制删除根路径',
    suggestion: '该操作会清空整个磁盘，已被禁止',
    test: /\brm\s+.*-[a-z]*r[a-z]*f[^;]*\s\/\s*($|[;|&])/i,
  },
  {
    id: 'fork-bomb',
    level: 'critical',
    reason: 'Fork 炸弹会导致系统资源耗尽',
    suggestion: '该命令已被安全策略禁止',
    test: /:\(\)\s*\{\s*:\|\s*:\s*&\s*\}\s*;\s*:/,
  },
  {
    id: 'mkfs',
    level: 'critical',
    reason: '格式化磁盘操作会清空所有数据',
    suggestion: '确认目标设备是否正确，避免格式化系统盘',
    test: /\bmkfs\b/i,
  },
  {
    id: 'dd-to-disk',
    level: 'critical',
    reason: '直接写入块设备会覆盖磁盘数据',
    suggestion: 'dd of=/dev/sd* 等操作极其危险，请确认目标路径',
    test: /\bdd\b[^;|&]*\bof\s*=\s*\/dev\/(sd|hd|nvme|vd)[a-z]/i,
  },
  {
    id: 'shutdown',
    level: 'critical',
    reason: '关机或重启会中断当前工作',
    suggestion: '如需重启请手动在系统层面操作',
    test: /\b(shutdown|reboot|halt|poweroff)\b/i,
  },
  {
    id: 'init-halt',
    level: 'critical',
    reason: 'init 0/6 会关机或重启系统',
    suggestion: '该命令已被禁止',
    test: /\binit\s+[06]\b/,
  },
  {
    id: 'win-format',
    level: 'critical',
    reason: 'Windows 格式化命令会清空分区',
    suggestion: '该操作已被禁止',
    test: /\bformat\s+[A-Z]:/i,
  },
  {
    id: 'win-rd-system',
    level: 'critical',
    reason: '递归删除 Windows 系统目录',
    suggestion: '该操作已被禁止',
    test: /\brd\s+\/s\s+\/q\s+[A-Z]:\\/i,
  },
  {
    id: 'chmod-root',
    level: 'critical',
    reason: '递归修改根目录权限会导致系统不可用',
    suggestion: '避免对 / 执行 chmod -R',
    test: /\bchmod\s+[^;|&]*-R[^;|&]*\s\/(\s|$|[;|&])/i,
  },
  {
    id: 'chown-root',
    level: 'critical',
    reason: '递归修改根目录属主会导致系统不可用',
    suggestion: '避免对 / 执行 chown -R',
    test: /\bchown\s+[^;|&]*-R[^;|&]*\s\/(\s|$|[;|&])/i,
  },
  {
    id: 'write-block-device',
    level: 'critical',
    reason: '直接覆写块设备或系统关键文件',
    suggestion: '检查重定向目标是否为 /dev/sd* 或 /etc/passwd 等关键路径',
    test: />\s*\/dev\/(sd|hd|nvme|vd)[a-z]/i,
  },
]

const RISKY_PATTERNS: Pattern[] = [
  {
    id: 'rm-recursive',
    level: 'risky',
    reason: '递归删除文件，操作不可恢复',
    suggestion: '请确认删除路径是否正确，可先用 list_dir 或 git status 检查',
    test: /\brm\s+[^;|&]*-[a-z]*r/i,
  },
  {
    id: 'rm-force',
    level: 'risky',
    reason: '强制删除会跳过确认',
    suggestion: '建议先确认文件列表，避免误删',
    test: /\brm\s+[^;|&]*-[a-z]*f/i,
  },
  {
    id: 'sudo',
    level: 'risky',
    reason: '提权执行可能影响系统全局',
    suggestion: '确认是否需要在工作区内使用 sudo',
    test: /\bsudo\b/i,
  },
  {
    id: 'chmod-recursive',
    level: 'risky',
    reason: '递归修改权限影响范围较大',
    suggestion: '确认目标目录是否正确',
    test: /\bchmod\s+[^;|&]*-R/i,
  },
  {
    id: 'chown-recursive',
    level: 'risky',
    reason: '递归修改属主影响范围较大',
    suggestion: '确认目标目录是否正确',
    test: /\bchown\s+[^;|&]*-R/i,
  },
  {
    id: 'git-hard-reset',
    level: 'risky',
    reason: 'git reset --hard 会丢弃未提交的改动',
    suggestion: '可先执行 git status / git diff 确认',
    test: /\bgit\s+reset\s+--hard\b/i,
  },
  {
    id: 'git-clean-force',
    level: 'risky',
    reason: 'git clean -f 会删除未跟踪文件',
    suggestion: '先用 git clean -n 预览',
    test: /\bgit\s+clean\s+[^;|&]*-[a-z]*f/i,
  },
  {
    id: 'git-push-force',
    level: 'risky',
    reason: '强制推送会覆盖远程分支历史',
    suggestion: '确认分支是否正确，避免覆盖他人提交',
    test: /\bgit\s+push\s+[^;|&]*--force|\bgit\s+push\s+[^;|&]*\s-f\b/i,
  },
  {
    id: 'curl-pipe-sh',
    level: 'risky',
    reason: '下载并直接执行远程脚本风险极高',
    suggestion: '请先检查脚本来源是否可信',
    test: /\b(curl|wget)\b[^;|&]*\|\s*(sh|bash|zsh|pwsh|powershell)\b/i,
  },
  {
    id: 'find-delete',
    level: 'risky',
    reason: '批量查找并删除文件影响范围大',
    suggestion: '先用 find 预览匹配结果',
    test: /\bfind\b[^;|&]*-delete\b/i,
  },
  {
    id: 'find-exec-rm',
    level: 'risky',
    reason: '批量查找并删除文件影响范围大',
    suggestion: '先用 find 预览匹配结果',
    test: /\bfind\b[^;|&]*-exec\s+rm\b/i,
  },
  {
    id: 'kill-all',
    level: 'risky',
    reason: '批量终止进程可能影响系统服务',
    suggestion: '确认目标进程是否正确',
    test: /\b(killall|pkill)\b/i,
  },
  {
    id: 'docker-prune',
    level: 'risky',
    reason: '批量清理 Docker 资源会删除未使用的镜像和容器',
    suggestion: '确认是否需要执行 prune',
    test: /\bdocker\s+system\s+prune\b/i,
  },
  {
    id: 'npm-publish',
    level: 'risky',
    reason: '发布包到公共仓库不可撤回',
    suggestion: '确认版本号和发布目标是否正确',
    test: /\bnpm\s+publish\b/i,
  },
  {
    id: 'powershell-encoded',
    level: 'risky',
    reason: 'PowerShell 编码命令可能隐藏恶意逻辑',
    suggestion: '请检查命令是否来自可信来源',
    test: /\bpowershell\b[^;|&]*EncodedCommand/i,
  },
  {
    id: 'powershell-iex',
    level: 'risky',
    reason: 'PowerShell 动态执行需谨慎',
    suggestion: '请确认脚本来源可信',
    test: /\bpowershell\b[^;|&]*Invoke-Expression|\bIEX\b/i,
  },
  {
    id: 'reg-delete',
    level: 'risky',
    reason: '删除注册表项会影响系统配置',
    suggestion: '确认注册表路径是否正确',
    test: /\breg\s+delete\b/i,
  },
  {
    id: 'redirect-system',
    level: 'risky',
    reason: '重定向覆盖系统关键路径',
    suggestion: '检查输出目标是否为系统文件',
    test: />\s*\/(etc|usr|var)\//i,
  },
]

const ALL_PATTERNS = [...CRITICAL_PATTERNS, ...RISKY_PATTERNS]

export function assessShellCommand(command: string): ShellRiskAssessment | null {
  const value = String(command || '').trim()
  if (!value) return null
  for (const pattern of ALL_PATTERNS) {
    const match = value.match(pattern.test)
    if (match) {
      const matched = match[0].trim().slice(0, 120)
      return {
        level: pattern.level,
        reason: pattern.reason,
        matched,
        suggestion: pattern.suggestion,
        patternId: pattern.id,
      }
    }
    pattern.test.lastIndex = 0
  }
  return null
}
