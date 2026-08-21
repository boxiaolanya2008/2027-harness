# 共创者

Super-Agent 由人类与多个 AI 编码代理协作开发。每个 AI 代理在经手的提交中以 `Co-authored-by` 尾注署名：

| 共创者 | 署名邮箱 | 说明 |
| --- | --- | --- |
| Copilot | `198982749+Copilot@users.noreply.github.com` | GitHub 官方 Copilot 账号，提交页显示头像 |
| Claude | `noreply@anthropic.com` | Anthropic 官方约定署名 |
| Cursor | `noreply@cursor.com` | Cursor Agent 署名 |
| Gemini | `noreply@google.com` | Google Gemini CLI 署名 |
| Devin | `noreply@devin.ai` | Cognition Devin 署名 |

> [!NOTE]
> 只有映射到真实 GitHub 账号的邮箱（如 Copilot）会在提交页显示头像并计入贡献；其余显示为共创者文字。

署名由 `.githooks/prepare-commit-msg` 钩子自动追加，克隆后执行一次即可启用：

```bash
git config core.hooksPath .githooks
git config commit.template .githooks/commit-template.txt
```
