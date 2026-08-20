import type { ToolDef } from './openai'

export const TOOLS: ToolDef[] = [
  { type: 'function', function: { name: 'read_file', description: '读取工作区内某个文件的文本内容。path 为相对路径。', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: '写入/覆盖工作区内某个文件。path 为相对路径，content 为完整新内容。适合新建文件或整体重写。', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'incrementally_edit', description: '精确替换工作区内文件的一段已有文本。适合局部修复：old_string 必须匹配当前内容且默认只能匹配一处；多处替换时显式设置 replace_all。', parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['path', 'old_string', 'new_string'] } } },
  { type: 'function', function: { name: 'list_dir', description: '列出工作区内某个目录下的条目。path 省略则列根目录。', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'run_command', description: '在工作区目录下执行 shell 命令（如 npm test、python x.py）。command 为完整命令字符串。输出会作为结果返回。', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'git_status', description: '查看工作区 git 状态（未提交改动）。', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'git_diff', description: '查看工作区未提交的 diff。', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'git_commit', description: '暂存全部改动并提交，message 为提交信息。', parameters: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } } },
  { type: 'function', function: { name: 'git_new_branch', description: '基于当前分支创建并切换到新分支，branch 为新分支名。', parameters: { type: 'object', properties: { branch: { type: 'string' } }, required: ['branch'] } } },
  { type: 'function', function: { name: 'git_push', description: '把当前分支推送到 origin（需先 git_new_branch），branch 为分支名。推送后如需开 PR，请告知用户。', parameters: { type: 'object', properties: { branch: { type: 'string' } }, required: ['branch'] } } }
]

export const SYSTEM = `你是 Super-Agent，一个能直接操作本地代码仓库的 AI 编码代理。
你有一个工作区目录，可以读文件、写文件、列目录、跑命令、做 git 操作。
规则：
- 动手前先想清楚，需要看代码就先 read_file / list_dir。
- 新建文件或整体重写用 write_file；局部 bug 修复优先用 incrementally_edit，old_string 要提供足够上下文确保唯一匹配。改完尽量跑命令验证（如 npm test）。
- git_commit / git_new_branch / git_push 只在用户明确要求时才调用。
- 用中文回答，简洁直接，给结论再给细节。`

export async function execTool(
  workspace: string,
  name: string,
  args: Record<string, any>,
  context?: { conversationId: string; turnId: string; toolCallId: string }
) {
  switch (name) {
    case 'read_file':
      return await window.api.fs.read(workspace, args.path)
    case 'write_file': {
      const snapshot = await window.api.fs.write(workspace, args.path, args.content, context)
      return JSON.stringify({ type: 'file_snapshot', ...snapshot })
    }
    case 'incrementally_edit': {
      const snapshot = await window.api.fs.incrementallyEdit(
        workspace,
        args.path,
        args.old_string,
        args.new_string,
        args.replace_all,
        context
      )
      return JSON.stringify({ type: 'file_snapshot', ...snapshot })
    }
    case 'list_dir': {
      const items = await window.api.fs.list(workspace, args.path || '.')
      return items.map((i: { type: string; path: string }) => `${i.type === 'dir' ? '[d]' : '[f]'} ${i.path}`).join('\n')
    }
    case 'run_command': {
      const shellPref = (() => {
        try { return localStorage.getItem('codex_shell') || '' } catch { return '' }
      })()
      const isWin = navigator.userAgent.includes('Windows')
      let cmd: string
      let rest: string[]
      if (shellPref === 'PowerShell') {
        cmd = isWin ? 'powershell.exe' : 'pwsh'
        rest = ['-NoProfile', '-Command', args.command]
      } else if (shellPref === 'Git Bash') {
        cmd = 'bash'
        rest = ['-c', args.command]
      } else if (shellPref === 'CMD') {
        cmd = 'cmd'
        rest = ['/c', args.command]
      } else {
        ;[cmd, rest] = isWin ? ['cmd', ['/c', args.command]] : ['sh', ['-c', args.command]]
      }
      const out = await window.api.shell.run(workspace, cmd, rest, context)
      return `exit=${out.code}\n${out.output || '(无输出)'}`
    }
    case 'git_status':
      return (await window.api.git.status(workspace)) || '(工作区干净)'
    case 'git_diff':
      return (await window.api.git.diff(workspace)) || '(无改动)'
    case 'git_commit': {
      const result = await window.api.git.commitAll(workspace, args.message)
      return result?.committed ? `已提交：${args.message}` : '没有可提交的改动；未创建提交'
    }
    case 'git_new_branch':
      await window.api.git.newBranch(workspace, args.branch)
      return `已创建并切换到分支 ${args.branch}`
    case 'git_push':
      await window.api.git.push(workspace, args.branch)
      return `已推送 ${args.branch}`
    default:
      throw new Error(`未知工具 ${name}`)
  }
}
