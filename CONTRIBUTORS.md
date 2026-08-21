# 共创者

Super-Agent 由人类与多个 AI 编码代理协作开发。每个 AI 代理在经手的提交中以 `Co-authored-by` 尾注署名，署名邮箱均指向各官方 GitHub 账号：

| 共创者 | 署名邮箱 | 官方账号 |
| --- | --- | --- |
| Copilot | `198982749+Copilot@users.noreply.github.com` | [Copilot](https://github.com/Copilot)（GitHub 官方） |
| Claude | `noreply@anthropic.com` | [claude](https://github.com/claude)（Anthropic 认领） |
| Cursor | `126759922+cursor@users.noreply.github.com` | [cursor](https://github.com/cursor)（Anysphere 官方组织） |
| Gemini | `224641728+gemini-cli-robot@users.noreply.github.com` | [gemini-cli-robot](https://github.com/gemini-cli-robot)（Google gemini-cli 官方机器人，与 gemini-cli 仓库提交一致） |
| Devin | `158243242+devin-ai-integration[bot]@users.noreply.github.com` | [devin-ai-integration[bot]](https://github.com/devin-ai-integration[bot])（Cognition 官方机器人） |

> [!NOTE]
> 头像能否显示取决于署名邮箱是否对应真实 GitHub 账号；上表邮箱均取自各官方账号或其机器人在公开提交中实际使用的地址。

署名由 `.githooks/prepare-commit-msg` 钩子自动追加，克隆后执行一次即可启用：

```bash
git config core.hooksPath .githooks
git config commit.template .githooks/commit-template.txt
```
