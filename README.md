# Super-Agent

2027 版 AI 编码代理桌面应用。Windows 下的 Electron 应用，主界面是 AI 对话控制台，能直接操作本地代码仓库和 GitHub——读文件、改代码、跑命令、提 PR，都能做。

## 特性

- **自主编码 Agent**：给个任务，它自己规划 → 读文件 → 改代码 → 跑命令验证 → 迭代到完成。工具调用全程流式可见，可随时中止。
- **一键生成并推送 PR**：git diff → AI 生成 commit message / PR title / body → 建分支 → 提交 → 推送 → 开 PR。
- **GitHub 集成**：PR / Issue 管理、提交时间线可视化、每个条目一键 AI 总结。
- **多工作区**：选任意本地目录作为工作区，Agent 的所有文件 / shell / git 操作都限定在该目录内。
- **安全存储**：API key 和 GitHub token 用 Electron safeStorage（系统钥匙串）加密，不进 localStorage。

## 技术栈

Electron + electron-vite + Vue 3 + TypeScript + Element Plus + Pinia + Vue Router + @vueuse/core + ECharts + @iconify/vue + animate.css + axios + dayjs + nprogress。

## 安装

需要 Node.js ≥ 20。

```bash
npm install
```

## Quick Start

```bash
npm run dev
```

首次进入会自动跳到设置页：

1. **AI Provider**：填 API Base URL、模型名、API key，点「测试连接」验证。
2. **GitHub**：填 Personal Access Token（需 `repo` scope）。可以点「从本地 git config 导入身份」自动读取 `user.name` / `user.email`。
3. 保存后进入主界面。

在右侧面板「工作区」选一个本地代码目录，然后就能给 Agent 下任务了。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run typecheck` | TS 类型检查 |
| `npm start` | 预览构建产物 |

## GitHub token

在 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) 创建，勾选 `repo` scope。token 只存在本机系统钥匙串里，经主进程代理调用 GitHub API，不会暴露给页面。

## 说明

- Agent 的 shell / git / fs 操作全部限定在工作区内，越界会被拒绝。
- 「一键 PR」依赖 remote origin 指向 GitHub；推送前请确认分支与仓库权限。
