# 安全

## 报告漏洞

发现安全问题不要发公开 issue，直接发邮件到维护者（见 git 提交邮箱），或私信仓库 owner。

## 已知安全边界

- API key 与 GitHub token 用 Electron safeStorage 加密，只存在本机系统钥匙串。
- GitHub REST 全部经主进程代理，token 不出主进程、不进页面。
- Agent 的 fs / shell / git 操作严格限定在工作区目录内，越界路径会被拒绝。
- 不要把你的 token 提交进仓库或分享出去。
