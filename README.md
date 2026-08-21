# Super-Agent

中文 | [English](README_EN.md)

2027 版 AI 编码代理桌面应用。Windows 下的 Electron 应用，主界面是 AI 对话控制台，能直接操作本地代码仓库和 GitHub——读文件、改代码、跑命令、提 PR，都能做。

## 特性

- **自主编码 Agent**：给个任务，它自己规划 → 读文件 → 改代码 → 跑命令验证 → 迭代到完成。工具调用全程流式可见，可随时中止。
- **一键生成并推送 PR**：git diff → AI 生成 commit message / PR title / body → 建分支 → 提交 → 推送 → 开 PR。
- **GitHub 集成**：PR / Issue 管理、提交时间线可视化、每个条目一键 AI 总结。
- **多工作区**：选任意本地目录作为工作区，Agent 的所有文件 / shell / git 操作都限定在该目录内。
- **安全存储**：API key 和 GitHub token 用 Electron safeStorage（系统钥匙串）加密，不进 localStorage。

## 安装

**方式一：下载安装包（推荐普通用户）**

到 [Releases](https://github.com/boxiaolanya2008/2027-harness/releases/latest) 下载 `Super-Agent Setup x.x.x.exe`，双击安装即可，可选安装目录，自动创建桌面和开始菜单快捷方式。

> [!NOTE]
> 安装包只提供 Windows x64 版本。Windows 可能会弹 SmartScreen 提示「未知发布者」——应用目前没有做代码签名，点「仍要运行」即可；介意的话可以自己从源码构建。

> [!WARNING]
> 请只从本仓库的 Releases 页面下载安装包，不要使用任何第三方转载的版本。

**方式二：从源码构建**

需要 Node.js ≥ 20 和 Git。

```bash
git clone https://github.com/boxiaolanya2008/2027-harness.git
cd 2027-harness
npm install
npm run dev
```

## Quick Start

首次进入会自动跳到设置页：

1. **AI Provider**：填 API Base URL、模型名、API key，点「测试连接」验证。
2. **GitHub**：填 Personal Access Token（需 `repo` scope）。可以点「从本地 git config 导入身份」自动读取 `user.name` / `user.email`。
3. 保存后进入主界面。

在右侧面板「工作区」选一个本地代码目录，然后就能给 Agent 下任务了。

> [!IMPORTANT]
> Agent 会真实读写你选的工作区并执行真实命令。开始前请确认：
>
> - 工作区里的代码已经提交或备份，Agent 的改动虽然支持安全撤回，但别拿唯一一份代码冒险；
> - 不要把系统目录、含敏感文件的目录设为工作区——操作会被限制在工作区内，但工作区内的文件它都能碰到。

> [!TIP]
> 「完全访问权限」模式会放开更多限制并带背景模糊动效，建议只在信任的项目里开。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run dist` | 打包 Windows 安装程序 |
| `npm run typecheck` | TS 类型检查 |
| `npm start` | 预览构建产物 |

## GitHub token

在 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) 创建，勾选 `repo` scope。token 只存在本机系统钥匙串里，经主进程代理调用 GitHub API，不会暴露给页面。

> [!CAUTION]
> token 等同于你账号对该仓库的完整写权限，不要截图、粘贴给任何人或提交进任何仓库。设置页里已保存的 token 只显示遮罩，输入框留空保存表示保留旧值。

## 已知限制

> [!WARNING]
> - 「一键 PR」依赖 remote origin 指向 GitHub，推送前请确认分支与仓库权限；
> - 项目处于早期版本（v0.2.x），接口和行为可能随版本调整，升级前建议先看 [Release Notes](https://github.com/boxiaolanya2008/2027-harness/releases)；
> - 遇到 GitHub 请求报证书错误时，应用会保留证书校验并直接报错，不会静默跳过——这通常是你所在网络的代理问题，请勿寻找关闭校验的改法。

## 说明

- Agent 的 shell / git / fs 操作全部限定在工作区内，越界会被拒绝。
- 图标离线注册，不依赖 Iconify CDN，可完全离线运行（模型请求除外）。

## 共创者

Super-Agent 由人类与多个 AI 编码代理协作开发，完整名单见 [CONTRIBUTORS.md](CONTRIBUTORS.md)。
