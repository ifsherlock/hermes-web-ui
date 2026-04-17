# Docker Compose Guide

This repository ships an environment-variable driven Docker Compose setup.

## Quick Start

```bash
docker compose up -d --build hermes-agent hermes-webui
docker compose logs -f hermes-webui
```

Open: `http://localhost:6060`

## Environment Variables

All key runtime settings are configured from compose variables.
This compose file runs two services together:

- `hermes-agent` (image: `nousresearch/hermes-agent`)
- `hermes-webui` (built from this repository)

Compose mapping highlights:

- Host/browser port: `${PORT}:${PORT}`
- Server `PORT` is set from `${PORT}`
- Upstream is set from `${UPSTREAM}`
- Hermes CLI binary is set from `${HERMES_BIN}`
- Hermes base image is set from `${HERMES_AGENT_IMAGE}` (used by both `hermes-agent` and webui build base)

Override variables directly from shell when running compose:

```bash
PORT=16060 \
UPSTREAM=http://127.0.0.1:8642 \
HERMES_BIN=/opt/hermes/.venv/bin/hermes \
docker compose up -d --build hermes-agent hermes-webui
```

## Data Persistence

- Hermes runtime data persists in `${HERMES_DATA_DIR}`.
- Default path is `./hermes_data`.

## Code Runtime Behavior

- Server upstream comes from `UPSTREAM` env (`packages/server/src/config.ts`).
- Hermes CLI binary comes from `HERMES_BIN` env (`packages/server/src/services/hermes-cli.ts`).
- If `HERMES_BIN` is not provided, code falls back to `hermes` in `PATH`.

## Common Operations

Recreate webui:

```bash
docker compose up -d --no-deps --force-recreate hermes-webui
```

Stop:

```bash
docker compose down
```
