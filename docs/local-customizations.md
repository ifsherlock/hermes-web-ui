# 本地定制说明

本文记录本 fork 相对上游 `EKKOLearnAI/hermes-web-ui` 需要长期保留的本地定制。以后从主线同步代码时，除非明确决定恢复官方逻辑，应保留这些改动。

## 保留改动

1. 移除 `apikey.fun` / API Relay / 中转站推广入口。
   - 侧边栏不展示外链推广。
   - Provider 弹窗不展示获取 API Key 的推广提示。
   - 不再把自定义 `apikey.fun` Base URL 自动改写为内置 `fun-codex` / `fun-claude` provider。
   - 内置 provider 列表不再包含 `Codex-apikey.fun` 和 `Claude-apikey.fun`。

2. 区分真实用户和 Hermes 智能体配置。
   - 系统菜单里的 `用户` 仍表示真实登录用户/账户管理。
   - 侧边栏底部的 profile 选择器显示为 `智能体`，用于选择 `default` 等 Hermes agent/profile。

## 主要涉及文件

- `packages/client/src/components/layout/AppSidebar.vue`
- `packages/client/src/components/layout/ProfileSelector.vue`
- `packages/client/src/components/hermes/models/ProviderFormModal.vue`
- `packages/client/src/i18n/locales/*.ts`
- `packages/server/src/shared/providers.ts`
- `packages/server/src/services/config-helpers.ts`
- `packages/client/src/utils/providerBaseUrl.ts`
- `tests/client/provider-base-url.test.ts`

## 同步上游时的注意事项

从上游合并代码后，重点检查：

- 是否又新增了 `apikey.fun`、`API Relay`、`中转站`、`fun-codex`、`fun-claude` 的前端可见入口。
- `ProfileSelector.vue` 是否仍使用 `sidebar.agentProfile`，而不是复用 `sidebar.profiles`。
- `sidebar.profiles` 不要改成智能体，它代表系统区域里的真实用户入口。
