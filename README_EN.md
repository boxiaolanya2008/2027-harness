# Super-Agent

[中文](README.md) | English

An AI coding agent desktop app for 2027. Electron app running on Windows — the main window is an AI chat console that works directly on your local repositories and GitHub: read files, edit code, run commands, open PRs.

## Features

- **Autonomous coding agent**: give it a task and it plans → reads files → edits code → runs commands to verify → iterates until done. Every tool call is streamed live and can be aborted anytime.
- **One-click PR**: git diff → AI-generated commit message / PR title / body → branch → commit → push → open PR.
- **GitHub integration**: PR / Issue management, commit timeline visualization, one-click AI summaries for every entry.
- **Multi-workspace**: pick any local directory as a workspace. All agent file / shell / git operations are confined to that directory.
- **Secure storage**: API keys and GitHub tokens are encrypted with Electron safeStorage (OS keychain), never stored in localStorage.

## Installation

**Option 1: download the installer (recommended)**

Grab `Super-Agent Setup x.x.x.exe` from [Releases](https://github.com/boxiaolanya2008/2027-harness/releases/latest) and run it. You can pick the install directory; desktop and Start Menu shortcuts are created automatically.

> [!NOTE]
> Only Windows x64 builds are provided. Windows may show a SmartScreen "unknown publisher" warning — the app is not code-signed yet, just click "Run anyway". If that bothers you, build from source.

> [!WARNING]
> Only download installers from this repository's Releases page. Do not use copies hosted elsewhere.

**Option 2: build from source**

Requires Node.js ≥ 20 and Git.

```bash
git clone https://github.com/boxiaolanya2008/2027-harness.git
cd 2027-harness
npm install
npm run dev
```

## Quick Start

The first launch takes you straight to setup:

1. **AI Provider**: fill in API Base URL, model name and API key, then hit "Test connection".
2. **GitHub**: paste a Personal Access Token (`repo` scope). You can also click "Import identity from local git config" to auto-read `user.name` / `user.email`.
3. Save and you land in the main workspace.

Pick a local code directory as your workspace in the right panel, then start giving the agent tasks.

> [!IMPORTANT]
> The agent reads and writes your workspace for real and executes real commands. Before you start:
>
> - Commit or back up your code first. Agent changes support safe revert, but don't gamble your only copy;
> - Never point the workspace at system directories or folders containing sensitive files — operations are confined to the workspace, but within it the agent can touch everything.

> [!TIP]
> "Full access" mode lifts more restrictions and comes with a liquid-glass blur effect. Enable it only for projects you trust.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Development mode |
| `npm run build` | Production build |
| `npm run dist` | Package Windows installer |
| `npm run typecheck` | TypeScript type check |
| `npm start` | Preview the build output |

## GitHub token

Create one under GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) with the `repo` scope. The token is stored only in your OS keychain and GitHub API calls are proxied through the main process — it is never exposed to the page.

> [!CAUTION]
> A token grants full write access to your repositories. Never screenshot it, paste it into chats, or commit it anywhere. Saved tokens are shown masked only; leaving the input empty on save keeps the old value.

## Known limitations

> [!WARNING]
> - "One-click PR" requires remote origin to point at GitHub; confirm branch and repository permissions before pushing;
> - The project is early-stage (v0.2.x); interfaces and behavior may change between versions — check the [Release Notes](https://github.com/boxiaolanya2008/2027-harness/releases) before upgrading;
> - On TLS certificate errors the app keeps certificate verification on and fails loudly instead of silently skipping — this usually means a proxy issue on your network. Do not look for ways to disable verification.

## Notes

- All agent shell / git / fs operations are confined to the workspace; out-of-bounds access is rejected.
- Icons are registered offline (no Iconify CDN); the app runs fully offline except for model requests.

## Co-creators

Super-Agent is built by humans together with AI coding agents. See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the full list.
