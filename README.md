<p align="center">
  <strong>Hermes Web UI</strong>
  <a href="./README_zh.md">中文</a>
</p>

<p align="center">
  A full-featured web dashboard for <a href="https://github.com/NousResearch/hermes-agent">Hermes Agent</a>.<br/>
  Manage AI chat sessions, monitor usage & costs, configure platform channels,<br/>
  schedule cron jobs, browse skills — all from a clean, responsive web interface.
</p>

<p align="center">
  <code>npm install -g hermes-web-ui && hermes-web-ui start</code>
</p>

<p align="center">
  <img src="https://github.com/EKKOLearnAI/hermes-web-ui/blob/main/packages/client/src/assets/output.gif" alt="Hermes Web UI Demo" width="680"/>
</p>

<p align="center">
  <strong>Mobile</strong>
</p>
<p align="center">
  <video src="https://github.com/EKKOLearnAI/hermes-web-ui/blob/main/packages/client/src/assets/video.mp4?raw=true" width="360" controls></video>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/hermes-web-ui"><img src="https://img.shields.io/npm/v/hermes-web-ui?style=flat-square&color=blue" alt="npm version"/></a>
  <a href="https://github.com/EKKOLearnAI/hermes-web-ui/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/hermes-web-ui?style=flat-square" alt="license"/></a>
  <a href="https://github.com/EKKOLearnAI/hermes-web-ui/stargazers"><img src="https://img.shields.io/github/stars/EKKOLearnAI/hermes-web-ui?style=flat-square" alt="stars"/></a>
</p>

---

## Features

### AI Chat

- Real-time streaming via SSE with async run support
- Multi-session management — create, rename, delete, switch between sessions
- Session grouping by source (Telegram, Discord, Slack, etc.) with collapsible accordion
- Markdown rendering with syntax highlighting and code copy
- Tool call detail expansion (arguments / result)
- File upload support
- Global model selector — discovers models from `~/.hermes/auth.json` credential pool
- Per-session model display badge and context token usage

### Platform Channels

Unified configuration for **8 platforms** in one page:

| Platform | Features |
|---|---|
| Telegram | Bot token, mention control, reactions, free-response chats |
| Discord | Bot token, mention, auto-thread, reactions, channel allow/ignore lists |
| Slack | Bot token, mention control, bot message handling |
| WhatsApp | Enable/disable, mention control, mention patterns |
| Matrix | Access token, homeserver, auto-thread, DM mention threads |
| Feishu (Lark) | App ID / Secret, mention control |
| WeChat | QR code login (scan in browser, auto-save credentials) |
| WeCom | Bot ID / Secret |

- Credential management writes to `~/.hermes/.env`
- Channel behavior settings write to `~/.hermes/config.yaml`
- Auto gateway restart on config change
- Per-platform configured/unconfigured status detection

### Usage Analytics

- Total token usage breakdown (input / output)
- Session count with daily average
- Estimated cost tracking & cache hit rate
- Model usage distribution chart
- 30-day daily trend (bar chart + data table)

### Scheduled Jobs

- Create, edit, pause, resume, delete cron jobs
- Trigger immediate execution
- Cron expression quick presets

### Model Management

- Auto-discover models from credential pool (`~/.hermes/auth.json`)
- Fetch available models from each provider endpoint (`/v1/models`)
- Add custom OpenAI-compatible providers
- Provider-level model grouping

### Skills & Memory

- Browse and search installed skills
- View skill details and attached files
- User notes and profile management

### Logs

- View agent / gateway / error logs
- Filter by log level, log file, and keyword
- Structured log parsing with HTTP access log highlighting

### Settings

- Display (streaming, compact mode, reasoning, cost display)
- Agent (max turns, timeout, tool enforcement)
- Memory (enable/disable, char limits)
- Session reset (idle timeout, scheduled reset)
- Privacy (PII redaction)
- API server configuration

### Web Terminal

- Integrated terminal powered by node-pty and @xterm/xterm
- Multi-session support — create, switch between, and close terminal sessions
- Real-time keyboard input and PTY output streaming via WebSocket
- Window resize support

---

## Quick Start

### npm (Recommended)

```bash
npm install -g hermes-web-ui
hermes-web-ui start
```

Open **http://localhost:8648**

### One-line Setup (Auto-detect OS)

Automatically installs Node.js (if missing) and hermes-web-ui on Debian/Ubuntu/macOS:

```bash
bash <(curl -fsSL https://cdn.jsdelivr.net/gh/EKKOLearnAI/hermes-web-ui@main/scripts/setup.sh)
```

### WSL

```bash
bash <(curl -fsSL https://cdn.jsdelivr.net/gh/EKKOLearnAI/hermes-web-ui@main/scripts/setup.sh)
hermes-web-ui start
```

> WSL auto-detects and uses `hermes gateway run` for background startup (no launchd/systemd).

### CLI Commands

| Command | Description |
|---|---|
| `hermes-web-ui start` | Start in background (daemon mode) |
| `hermes-web-ui start --port 9000` | Start on custom port |
| `hermes-web-ui stop` | Stop background process |
| `hermes-web-ui restart` | Restart background process |
| `hermes-web-ui status` | Check if running |
| `hermes-web-ui update` | Update to latest version & restart |
| `hermes-web-ui -v` | Show version number |
| `hermes-web-ui -h` | Show help message |

### Auto Configuration

On startup the BFF server automatically:

- Validates `~/.hermes/config.yaml` and fills missing `api_server` fields
- Backs up original config to `config.yaml.bak` if modified
- Detects and starts the gateway if needed
- Resolves port conflicts (kills stale processes)
- Opens browser on successful startup

---

## Development

```bash
git clone https://github.com/EKKOLearnAI/hermes-web-ui.git
cd hermes-web-ui
npm install
npm run dev
```

- Frontend: http://localhost:5173
- BFF Server: http://localhost:8648 (proxies to Hermes on 8642)

```bash
npm run build   # outputs to dist/
```

## Architecture

```
Browser → BFF (Koa, :8648) → Hermes Gateway (:8642)
                ↓
           Hermes CLI (sessions, logs, version)
                ↓
           ~/.hermes/config.yaml  (channel behavior)
           ~/.hermes/auth.json    (credential pool)
           Tencent iLink API      (WeChat QR login)
```

The frontend is designed with **multi-agent extensibility** — all Hermes-specific code is namespaced under `hermes/` directories (API, components, views, stores), making it straightforward to add new agent integrations alongside.

The BFF layer handles API proxy (with path rewriting), SSE streaming, file upload, session CRUD via CLI, config/credential management, WeChat QR login, model discovery, skills/memory management, log reading, and static file serving.

## Tech Stack

**Frontend:** Vue 3 + TypeScript + Vite + Naive UI + Pinia + Vue Router + vue-i18n + SCSS + markdown-it + highlight.js

**Backend:** Koa 2 (BFF server) + node-pty (web terminal)

## License

[MIT](./LICENSE)
