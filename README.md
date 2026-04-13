# Hermes Web UI

Web dashboard for [Hermes Agent](https://github.com/NousResearch/hermes-agent) — chat interaction, session management, scheduled jobs, platform channel configuration, and log viewing.

![Hermes Web UI Demo](https://github.com/EKKOLearnAI/hermes-web-ui/blob/main/src/assets/output.gif)

## Tech Stack

- **Vue 3** — Composition API + `<script setup>`
- **TypeScript**
- **Vite** — Build tool
- **Naive UI** — Component library
- **Pinia** — State management
- **Vue Router** — Routing (Hash mode)
- **vue-i18n** — Internationalization (Chinese / English)
- **Koa 2** — BFF server (API proxy, file upload, session management)
- **SCSS** — Style preprocessor
- **markdown-it** + **highlight.js** — Markdown rendering and code highlighting

## Install and Run

```bash
npm install -g hermes-web-ui
hermes-web-ui start
```

Open http://localhost:8648

### CLI Commands

| Command                           | Description                       |
| --------------------------------- | --------------------------------- |
| `hermes-web-ui start`             | Start in background (daemon mode) |
| `hermes-web-ui start --port 9000` | Start on custom port              |
| `hermes-web-ui stop`              | Stop background process           |
| `hermes-web-ui restart`           | Restart background process        |
| `hermes-web-ui status`            | Check if running                  |
| `hermes-web-ui`                   | Run in foreground (for debugging) |

### Auto Configuration

On startup, the BFF server automatically checks `~/.hermes/config.yaml` and ensures `platforms.api_server.enabled` is set to `true`. If modified, it backs up the original to `config.yaml.bak` and restarts the gateway.

## Development

```bash
git clone https://github.com/EKKOLearnAI/hermes-web-ui.git
cd hermes-web-ui
npm install
npm run dev
```

This starts:

- Frontend: http://localhost:5173
- BFF Server: http://localhost:8648 (proxies to Hermes on 8642)

### Build

```bash
npm run build
```

Outputs to `dist/` (frontend + compiled BFF server).

## Project Structure

```
hermes-web-ui/
├── bin/
│   └── hermes-web-ui.mjs         # CLI entry (start/stop/restart/status)
├── server/src/
│   ├── index.ts                   # BFF entry (Koa app bootstrap)
│   ├── config.ts                  # Configuration (port, upstream, etc.)
│   ├── routes/
│   │   ├── proxy.ts               # API proxy to Hermes (/api/*, /v1/*)
│   │   ├── config.ts              # Config & credentials management
│   │   ├── weixin.ts              # WeChat QR code login proxy
│   │   ├── upload.ts              # File upload (POST /upload)
│   │   ├── sessions.ts            # Session management via Hermes CLI
│   │   ├── filesystem.ts          # Skills, memory, config model management
│   │   ├── webhook.ts             # Webhook receiver
│   │   └── logs.ts                # Log file listing and reading
│   └── services/
│       └── hermes-cli.ts          # Hermes CLI wrapper (sessions, logs, version)
├── src/
│   ├── i18n/                      # Internationalization (en / zh)
│   │   ├── index.ts               # i18n instance setup
│   │   └── locales/
│   │       ├── en.ts              # English translations
│   │       └── zh.ts              # Chinese translations
│   ├── api/                       # Frontend API layer
│   ├── stores/                    # Pinia state management
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.vue     # Sidebar navigation
│   │   │   ├── LanguageSwitch.vue # Language toggle (EN / 中文)
│   │   │   └── ModelSelector.vue  # Global model selector
│   │   ├── chat/                  # Chat components
│   │   ├── jobs/                  # Job components
│   │   ├── models/                # Model/provider components
│   │   ├── settings/              # Settings components
│   │   │   ├── PlatformCard.vue   # Platform card with config status
│   │   │   └── PlatformSettings.vue  # Platform channel configuration
│   │   └── skills/                # Skill components
│   ├── views/
│   │   ├── ChatView.vue           # Chat page
│   │   ├── JobsView.vue           # Jobs page
│   │   ├── LogsView.vue           # Logs page
│   │   ├── ModelsView.vue         # Model management page
│   │   ├── ChannelsView.vue       # Platform channels page
│   │   ├── SkillsView.vue         # Skills page
│   │   ├── MemoryView.vue         # Memory page
│   │   └── SettingsView.vue       # Settings page
│   └── router/index.ts            # Router configuration
└── dist/                          # Build output (published to npm)
    ├── server/index.js            # Compiled BFF
    ├── index.html                 # Frontend entry
    └── assets/                    # Frontend static assets
```

## Features

### Chat

- Async Run + SSE event streaming via BFF proxy
- Session management via Hermes CLI
- Multi-session switching with message history
- Session grouping by source (Telegram, Discord, Slack, etc.) with collapsible accordion
- Session rename and deletion
- Markdown rendering with syntax highlighting and code copy
- Tool call detail expansion (arguments / result)
- File upload support (saved to temp, path passed to API)
- Model selector — automatically discovers available models from `~/.hermes/auth.json` credential pool
- Global model switching (updates `~/.hermes/config.yaml`)
- Per-session model display (badge in chat header and session list)

### Platform Channels

- Unified channel configuration page (Telegram, Discord, Slack, WhatsApp, Matrix, Feishu, WeChat, WeCom)
- Credential management — writes to `~/.hermes/.env` (matching `hermes gateway setup` behavior)
- Channel behavior settings — writes to `~/.hermes/config.yaml`
- WeChat QR code login — opens QR in browser, polls scan status, auto-saves credentials
- Auto gateway restart after any channel config change
- Per-platform configured/unconfigured status detection

### Model Management

- Automatically reads credential pool from `~/.hermes/auth.json`
- Fetches available models from each provider endpoint (`/v1/models`)
- Groups models by provider (e.g. zai, subrouter.ai)
- Add custom OpenAI-compatible providers
- Switching model updates `model.provider` in config.yaml to bypass env auto-detection
- Error handling: parallel fetching, per-provider timeout, fallback to config.yaml parsing

### Settings

- Display settings (streaming, compact mode, reasoning, cost, etc.)
- Agent settings (max turns, timeout, tool enforcement)
- Memory settings (enable/disable, char limits)
- Session reset settings (idle timeout, scheduled reset)
- Privacy settings (PII redaction)
- API server settings

### Scheduled Jobs

- Job list view (including paused/disabled jobs)
- Create, edit, pause, resume, and delete jobs
- Trigger immediate job execution
- Cron expression quick presets

### Skills & Memory

- Browse and search installed skills
- View skill details and attached files
- User notes and profile management

### Logs

- View Hermes agent/gateway/error logs
- Filter by log level, log file, and search keyword
- Structured log parsing with HTTP access log highlighting

### Other

- Internationalization — auto-detect browser language, manual toggle between Chinese and English
- Real-time connection status monitoring
- Hermes version display in sidebar
- Auto config check on startup
- Minimalist dark theme
- Session group collapse state persisted across navigation

## Architecture

```
Browser → BFF (Koa, :8648) → Hermes API (:8642)
                ↓
           Hermes CLI (sessions, logs, version)
                ↓
           ~/.hermes/config.yaml  (channel behavior)
           ~/.hermes/.env         (platform credentials)
           Tencent iLink API      (WeChat QR login)
```

The BFF layer handles:

- API proxy to Hermes (with header forwarding)
- SSE streaming passthrough
- File upload to temp directory
- Session CRUD via Hermes CLI
- Config & credential management (config.yaml + .env)
- WeChat QR code login flow (fetch QR, poll status, save credentials)
- Auto gateway restart on platform config changes
- Model discovery from `~/.hermes/auth.json` credential pool
- Skills, memory, and custom provider management
- Log file reading and parsing
- Static file serving (SPA fallback)

---

## License

[MIT](./LICENSE)
