ARG BASE_IMAGE=nousresearch/hermes-agent:latest
ARG NODE_VERSION=24.15.0

FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    make \
    g++ \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm ci --ignore-scripts && npm rebuild node-pty

COPY . .

RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM ${BASE_IMAGE}

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/node /usr/local/bin/node

RUN node --version

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV HOME=/home/agent
ENV HERMES_HOME=/home/agent/.hermes
ENV HERMES_BIN=/opt/hermes/.venv/bin/hermes
ENV HERMES_WEB_UI_MANAGED_GATEWAY=1
ENV PATH=/opt/hermes/.venv/bin:$PATH

EXPOSE 6060

ENTRYPOINT ["node", "dist/server/index.js"]
CMD []
