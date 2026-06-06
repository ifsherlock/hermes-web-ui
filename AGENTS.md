# Agent 规则

This repository is a local fork of `EKKOLearnAI/hermes-web-ui`. Keep detailed
project guidance in `docs/`, and keep private deployment notes out of committed
files.

## First Reads

- `DEVELOPMENT.md` - project commands, coding rules, test rules, and PR shape.
- `ARCHITECTURE.md` - package boundaries, data ownership, and runtime flow.
- `docs/harness/README.md` - how this repository is prepared for agent work.
- `docs/harness/validation.md` - which checks to run for each change type.
- `docs/harness/worktree-runbook.md` - isolated local dev and test setup.
- `docs/harness/pr-review.md` - self-review checklist before pushing.

## 本地定制

### 去除推广

- 不展示 `apikey.fun` / API Relay / 中转站相关推广入口。
- 侧边栏不要出现外链推广。
- Provider 弹窗不要出现获取 API Key 的推广提示。
- 不要把自定义 `apikey.fun` Base URL 自动改写为内置 `fun-codex` / `fun-claude` provider。
- 内置 provider 列表不要恢复 `Codex-apikey.fun` 和 `Claude-apikey.fun`。

### 区分用户和智能体

- 系统菜单里的 `用户` 表示真实登录用户/账户管理，不要改成智能体。
- 侧边栏底部的 profile 选择器表示 Hermes agent/profile，应显示为 `智能体`。
- `ProfileSelector.vue` 应使用 `sidebar.agentProfile`，不要复用 `sidebar.profiles`。

## 上游同步检查

合并上游后重点搜索：

- `apikey.fun`
- `API Relay`
- `中转站`
- `fun-codex`
- `fun-claude`
- `funProviderLink`
- `fun-link`
- `providerBaseUrl`

如果这些关键词重新出现在前端可见入口或 provider preset 中，需要重新移除。
服务端媒体图片兼容逻辑如果只是内部能力，不是前端推广，可以按实际用途保留。
