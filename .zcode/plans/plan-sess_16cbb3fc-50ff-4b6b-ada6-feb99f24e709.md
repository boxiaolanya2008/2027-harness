## 目标

Windows 桌面应用「Super-Agent」——2027 版 AI 编码代理。Electron + Vue3 + TS，主界面为 AI 对话控制台，能真正操作本地代码与 GitHub。所有功能走真实 API / 真实文件系统，禁止示例数据与空壳。

## 技术栈

electron-vite（main/preload/renderer 三进程结构）+ Vue3 + TS + Element Plus + Pinia + Vue Router + @vueuse/core + ECharts + @iconify/vue + animate.css + axios + dayjs + nprogress；marked + highlight.js 渲染 markdown/代码。包管理用 npm。

## 目录结构

```
2027-harness/
  electron.vite.config.ts / tsconfig*.json / package.json / .gitignore
  README.md / LICENSE(MIT) / CHANGELOG.md / CONTRIBUTING.md / SECURITY.md / CODE_OF_CONDUCT.md
  .github/                    # issue 模板 + CI workflow
  src/main/                   # Electron 主进程（Node，可跑 git/fs/shell）
    index.ts                  # 创建窗口、加载 renderer
    security.ts               # safeStorage 加密存 AI key / GitHub token
    ipc/
      git.ts                  # 读 git config、status/diff/commit/branch/push
      fs.ts                   # read/write/listDir（限定在工作区内）
      shell.ts                # runCommand，流式回传输出（Agent 用）
      github.ts               # GitHub REST v3 代理（token 留在主进程，避免 CORS）
      indexer.ts              # 本地仓库索引与语义搜索（RAG）
    indexer/                  # tokenizer、chunking、TF-IDF、embeddings client、索引缓存到磁盘
    agent/                    # Agent 循环：LLM+工具调用调度（主进程执行工具，流式回传）
  src/preload/
    index.ts                  # contextBridge 暴露 window.api（类型化 IPC）
    index.d.ts
  src/renderer/src/           # Vue UI
    main.ts / App.vue
    router/index.ts           # 守卫：未配置设置 → /setup
    styles/tokens.css         # 留白间距令牌、玻璃/卡片微交互工具类
    styles/main.css           # 液态玻璃背景、全局基础样式
    types/index.ts            # Settings/Message/ToolCall/Repo/PullRequest/Issue/Commit/SearchHit
    api/http.ts               # axios 实例（GitHub REST，token 经 IPC）
    api/openai.ts             # OpenAI 兼容 chat/completions，fetch SSE 流式解析；embeddings
    stores/settings.ts        # apiBaseUrl/model/apiKey/githubToken（经 IPC safeStorage）
    stores/chat.ts            # 会话、消息、Agent 运行状态、工具调用记录
    stores/github.ts          # 身份、仓库上下文、PR/Issue/时间线缓存
    stores/indexer.ts         # RAG：仓库索引状态、搜索结果
    components/
      EmptyState.vue          # 空状态：小插图+引导语（不白板）
      SkeletonCard.vue        # 骨架屏：灰色占位块，加载中显示
      GlassCard.vue           # 液态玻璃卡片：半透明磨砂+backdrop-filter，悬浮上浮+加深投影微交互
      PopoverMenu.vue         # Popover：存放少量操作（总结/刷新等）
      TimelineView.vue        # TimeLine：一条线串起节点，按时间展示提交历史
      MarkdownView.vue        # markdown+代码高亮渲染；DiffView.vue diff 预览；ToolCallLog.vue Agent工具调用流
    views/
      SetupView.vue           # AI Provider(api/model/key+测试连接) + GitHub token(+“从本地git config导入”按钮)
      ChatView.vue            # 主界面：会话列表(左)+AI对话+Agent工具调用流(中)+GitHub面板(右)
      SettingsView.vue        # 复用 SetupView，随时改配置
```

## 四大功能支柱

1. **自主编码 Agent（核心）**
   - Agent 循环跑在 renderer，工具经 IPC 由主进程执行。给任务 → LLM(带 tools spec) → tool_calls → 执行(read_file/write_file/list_dir/run_command/git_status/git_diff/git_commit/git_push) → 结果回喂 → 迭代至完成。
   - fetch SSE 流式展示推理与每次工具调用（ToolCallLog），可中止。
   - 「选择工作区」打开本地项目文件夹；所有 fs/shell/git 操作严格限定在该目录内。

2. **本地仓库语义搜索（RAG）**
   - 「问代码库」：对选定工作区建索引——按 .gitignore 过滤遍历文件、分块；优先用配置的 OpenAI-compatible `/embeddings`（如 text-embedding-3-small）做向量检索，无 embeddings 端点时降级 TF-IDF。
   - 索引缓存到磁盘（工作区/.super-agent-index.json），支持增量重建。
   - 「问代码库」结果作为上下文注入对话，回答“某功能在哪、怎么改”。

3. **一键生成并推送 PR**
   - GitHub tab「本地改动」：git status/diff → AI 生成 commit message + PR title/body → create branch → commit → push → GitHub API open PR（需 token repo scope）。
   - GitLab/GitHub remote owner/name 自动解析。

4. **GitHub “熟练掌握”**
   - PR/Issue：仓库选择器(`/user/repos`)→ tabs「Pull Requests」「Issues」，列表+详情展开，可创建 Issue。
   - 提交时间线：`/repos/{o}/{r}/commits`，TimelineView 按时间串节点。
   - AI 辅助总结：每个 PR/Issue/commit「让 AI 总结」→内容注入对话生成总结。
   - token(401)/限流(403)/网络错误统一处理。

## Git/GitHub 鉴权

- AI key + GitHub token：经 IPC → Electron safeStorage（OS keychain）加密存储，不进 localStorage。
- GitHub REST 全部经主进程代理，token 不出主进程。
- SetupView「从本地 git config 导入」→ IPC `git config --global user.name/email` 预填身份；token 手填后调 GET /user 校验并拉取身份。

## UI/主题落地

EmptyState/SkeletonCard/GlassCard/PopoverMenu/TimelineView/留白令牌全部作为真实组件被各视图使用；液态玻璃做全局背景层；卡片悬浮微交互内置于 GlassCard。

## Git

`git init`；脚手架阶段按 AGENTS.md 建齐 README/LICENSE/.gitignore/CHANGELOG/CONTRIBUTING/SECURITY/CODE_OF_CONDUCT/.github。

## 验证

- `npm run dev`：首访自动进 SetupView；配好 key/token → ChatView。
- Agent：给任务改代码→观察工具调用流与文件变更真实发生。
- RAG：建索引→“问代码库”命中真实文件。
- PR：对测试仓库跑一键 PR，确认分支推送与 PR 创建成功。
- GitHub tab /时间线/AI总结走真实数据。
- `npm run build` + type-check(`vue-tsc --noEmit`)通过。

## 说明

功能按支柱增量实现但全部真实可用；Electron/npm install（含下载 Electron 二进制）需联网。先跑通 Agent + GitHub，再上 RAG。