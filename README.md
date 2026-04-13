# Hermes Web UI

Web dashboard for [Hermes Agent](https://github.com/NousResearch/hermes-agent) — chat interaction, session management, scheduled jobs, and log viewing.

![Hermes Web UI Demo](https://github.com/EKKOLearnAI/hermes-web-ui/blob/main/src/assets/output.gif)

## Tech Stack

- **Vue 3** — Composition API + `<script setup>`
- **TypeScript**
- **Vite** — Build tool
- **Naive UI** — Component library
- **Pinia** — State management
- **Vue Router** — Routing (Hash mode)
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

| Command | Description |
|---------|-------------|
| `hermes-web-ui start` | Start in background (daemon mode) |
| `hermes-web-ui start --port 9000` | Start on custom port |
| `hermes-web-ui stop` | Stop background process |
| `hermes-web-ui restart` | Restart background process |
| `hermes-web-ui status` | Check if running |
| `hermes-web-ui` | Run in foreground (for debugging) |

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
│   │   ├── upload.ts              # File upload (POST /upload)
│   │   ├── sessions.ts            # Session management via Hermes CLI
│   │   ├── filesystem.ts          # Skills, memory, config model management
│   │   ├── webhook.ts             # Webhook receiver
│   │   └── logs.ts                # Log file listing and reading
│   └── services/
│       └── hermes-cli.ts          # Hermes CLI wrapper (sessions, logs, version)
├── src/
│   ├── api/                       # Frontend API layer
│   ├── stores/                    # Pinia state management
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.vue     # Sidebar navigation
│   │   │   └── ModelSelector.vue  # Global model selector
│   │   ├── chat/                  # Chat components
│   │   └── jobs/                  # Job components
│   ├── views/
│   │   ├── ChatView.vue           # Chat page
│   │   ├── JobsView.vue           # Jobs page
│   │   ├── LogsView.vue           # Logs page
│   │   └── SettingsView.vue       # Settings (model management)
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
- Markdown rendering with syntax highlighting and code copy
- File upload support (saved to temp, path passed to API)
- Model selector — automatically discovers available models from `~/.hermes/auth.json` credential pool
- Global model switching (updates `~/.hermes/config.yaml`)
- Per-session model display (badge in chat header and session list)

### Model Management
- Automatically reads credential pool from `~/.hermes/auth.json`
- Fetches available models from each provider endpoint (`/v1/models`)
- Groups models by provider (e.g. zai, subrouter.ai)
- Switching model updates `model.provider` in config.yaml to bypass env auto-detection
- Error handling: parallel fetching, per-provider timeout, fallback to config.yaml parsing

### Scheduled Jobs
- Job list view (including paused/disabled jobs)
- Create, edit, pause, resume, and delete jobs
- Trigger immediate job execution
- Cron expression quick presets

### Logs
- View Hermes agent/gateway/error logs
- Filter by log level, log file, and search keyword
- Structured log parsing with HTTP access log highlighting

### Other
- Real-time connection status monitoring
- Hermes version display in sidebar
- Auto config check on startup
- Minimalist dark theme

## Architecture

```
Browser → BFF (Koa, :8648) → Hermes API (:8642)
                ↓
           Hermes CLI (sessions, logs, version)
```

The BFF layer handles:
- API proxy to Hermes (with header forwarding)
- SSE streaming passthrough
- File upload to temp directory
- Session CRUD via Hermes CLI
- Model discovery from `~/.hermes/auth.json` credential pool
- Config.yaml model switching (reads/writes `~/.hermes/config.yaml`)
- Skills, memory, and custom provider management
- Log file reading and parsing
- Static file serving (SPA fallback)

---

## License

[MIT](./LICENSE)
