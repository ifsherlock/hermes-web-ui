<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { getApiKey, getBaseUrlValue } from "@/api/client";
import { NButton, NPopconfirm, NTooltip, useMessage } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const message = useMessage();

// ─── Types ──────────────────────────────────────────────────────

interface SessionInfo {
  id: string;
  shell: string;
  pid: number;
  title: string;
  createdAt: number;
  exited: boolean;
}

// ─── State ──────────────────────────────────────────────────────

const terminalRef = ref<HTMLDivElement | null>(null);
const showSessions = ref(true);
const sessions = ref<SessionInfo[]>([]);
const activeSessionId = ref<string | null>(null);

let ws: WebSocket | null = null;
// Keep all terminal instances alive, only dispose on close
const termMap = new Map<
  string,
  { term: Terminal; fitAddon: FitAddon; opened: boolean }
>();
let activeTerm: Terminal | null = null;
let activeFitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let mobileQuery: MediaQueryList | null = null;

// ─── Computed ──────────────────────────────────────────────────

const activeSession = computed(
  () => sessions.value.find((s) => s.id === activeSessionId.value) || null,
);

// ─── WebSocket ──────────────────────────────────────────────────

function buildWsUrl(): string {
  const token = getApiKey();
  const base = getBaseUrlValue();
  const wsProtocol = base
    ? base.startsWith("https")
      ? "wss:"
      : "ws:"
    : location.protocol === "https:"
      ? "wss:"
      : "ws:";

  if (base) {
    return `${wsProtocol}//${new URL(base).host}/api/hermes/terminal${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  }

  // Dev mode: connect directly to backend port; Production: same host
  const host = import.meta.env.DEV
    ? `${location.hostname}:8648`
    : location.host;
  return `${wsProtocol}//${host}/api/hermes/terminal${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

function connect() {
  const url = buildWsUrl();
  ws = new WebSocket(url);

  ws.onopen = () => {
    // Server auto-creates the first session and sends 'created'
  };

  ws.onmessage = (event) => {
    const data = typeof event.data === "string" ? event.data : "";
    if (data.charCodeAt(0) === 0x7b) {
      try {
        handleControl(JSON.parse(data));
      } catch {}
    } else {
      activeTerm?.write(data);
    }
  };

  // On reconnect, recreate all terminals for existing sessions
  ws.onopen = () => {
    // Server will auto-create the first session again
  };

  ws.onclose = () => {
    // Reconnect after delay
    setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    // let onclose handle reconnect
  };
}

function send(data: object | string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(typeof data === "string" ? data : JSON.stringify(data));
}

// ─── Control message handlers ──────────────────────────────────

function handleControl(msg: any) {
  switch (msg.type) {
    case "created":
      sessions.value.push({
        id: msg.id,
        shell: msg.shell,
        pid: msg.pid,
        title: `${msg.shell} #${sessions.value.length + 1}`,
        createdAt: Date.now(),
        exited: false,
      });
      switchSession(msg.id);
      break;

    case "switched":
      // Server confirmed switch — frontend already mounted in switchSession()
      break;

    case "exited": {
      const s = sessions.value.find((s) => s.id === msg.id);
      if (s) {
        s.exited = true;
        if (activeSessionId.value === msg.id) {
          activeTerm?.write(
            `\r\n\x1b[90m[${t("terminal.processExited", { code: msg.exitCode })}]\x1b[0m\r\n`,
          );
        }
      }
      break;
    }

    case "error":
      message.error(msg.message);
      break;
  }
}

// ─── Session actions ────────────────────────────────────────────

function createSession() {
  send({ type: "create" });
}

function getOrCreateTerm(id: string): { term: Terminal; fitAddon: FitAddon } {
  let entry = termMap.get(id);
  if (!entry) {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#1a1a2e",
        foreground: "#e0e0e0",
        cursor: "#4cc9f0",
        cursorAccent: "#1a1a2e",
        selectionBackground: "rgba(76, 201, 240, 0.3)",
        black: "#000000",
        red: "#e06c75",
        green: "#98c379",
        yellow: "#e5c07b",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#abb2bf",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
    entry = { term, fitAddon, opened: false };
    termMap.set(id, entry);
  }
  return entry;
}

function switchSession(id: string) {
  if (activeSessionId.value === id) return;
  activeSessionId.value = id;
  const entry = getOrCreateTerm(id);
  activeTerm = entry.term;
  activeFitAddon = entry.fitAddon;
  mountActiveTerminal();
  send({ type: "switch", sessionId: id });
  if (mobileQuery?.matches) showSessions.value = false;
}

function closeSession(id: string) {
  send({ type: "close", sessionId: id });
  sessions.value = sessions.value.filter((s) => s.id !== id);
  // Dispose terminal instance
  const entry = termMap.get(id);
  if (entry) {
    entry.term.dispose();
    termMap.delete(id);
  }
  if (activeSessionId.value === id) {
    activeSessionId.value =
      sessions.value.length > 0 ? sessions.value[0].id : null;
    activeTerm = null;
    activeFitAddon = null;
    if (activeSessionId.value) {
      switchSession(activeSessionId.value);
    } else {
      unmountActiveTerminal();
      createSession();
    }
  }
}

// ─── Terminal mount/unmount ─────────────────────────────────────

function mountActiveTerminal() {
  if (!terminalRef.value) return;
  const container = terminalRef.value;
  // Remove old terminal DOM from container
  while (container.firstChild) container.removeChild(container.firstChild);

  const entry = termMap.get(activeSessionId.value!);
  if (!entry) return;

  if (!entry.opened) {
    // First time: call open()
    entry.term.open(container);
    entry.opened = true;
  } else {
    // Already opened: move the existing DOM element
    const termEl = entry.term.element;
    if (termEl) {
      container.appendChild(termEl);
    }
  }

  // Resize observer
  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(() => {
    tryFit();
    sendResize();
  });
  resizeObserver.observe(terminalRef.value);

  // Fit after DOM is ready
  setTimeout(() => tryFit(), 50);
  setTimeout(() => tryFit(), 200);
}

function unmountActiveTerminal() {
  if (!terminalRef.value) return;
  const container = terminalRef.value;
  while (container.firstChild) container.removeChild(container.firstChild);
}

function tryFit() {
  if (!activeFitAddon) return;
  try {
    activeFitAddon.fit();
  } catch {}
}

function sendResize() {
  if (!activeTerm || !ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    send({
      type: "resize",
      cols: activeTerm.cols,
      rows: activeTerm.rows,
    });
  } catch {}
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function handleMobileChange(e: MediaQueryListEvent | MediaQueryList) {
  if (e.matches && showSessions.value) showSessions.value = false;
}

// ─── Lifecycle ──────────────────────────────────────────────────

onMounted(() => {
  mobileQuery = window.matchMedia("(max-width: 768px)");
  handleMobileChange(mobileQuery);
  mobileQuery.addEventListener("change", handleMobileChange);
  connect();
});

onUnmounted(() => {
  mobileQuery?.removeEventListener("change", handleMobileChange);
  unmountActiveTerminal();
  // Dispose all terminal instances
  for (const entry of termMap.values()) {
    entry.term.dispose();
  }
  termMap.clear();
  activeTerm = null;
  activeFitAddon = null;
  ws?.close();
  ws = null;
});
</script>

<template>
  <div class="terminal-panel">
    <!-- Session backdrop (mobile) -->
    <div
      class="session-backdrop"
      :class="{ active: showSessions }"
      @click="showSessions = false"
    />

    <!-- Session list sidebar -->
    <aside class="session-list" :class="{ collapsed: !showSessions }">
      <div class="session-list-header">
        <span v-if="showSessions" class="session-list-title">{{
          t("terminal.sessions")
        }}</span>
        <div class="session-list-actions">
          <!-- <button class="session-close-btn" @click="showSessions = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button> -->
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton quaternary size="tiny" @click="createSession" circle>
                <template #icon>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </template>
              </NButton>
            </template>
            {{ t("terminal.newTab") }}
          </NTooltip>
        </div>
      </div>
      <div v-if="showSessions" class="session-items">
        <div v-if="sessions.length === 0" class="session-empty">
          {{ t("common.loading") }}
        </div>
        <button
          v-for="s in sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === activeSessionId, exited: s.exited }"
          @click="switchSession(s.id)"
        >
          <div class="session-item-content">
            <span class="session-item-title">{{ s.title }}</span>
            <span class="session-item-meta">
              <span class="session-item-shell">{{ s.shell }}</span>
              <span v-if="s.exited" class="session-item-status">{{
                t("terminal.sessionExited")
              }}</span>
              <span v-else class="session-item-time">{{
                formatTime(s.createdAt)
              }}</span>
            </span>
          </div>
          <NPopconfirm
            v-if="sessions.length > 1"
            @positive-click="closeSession(s.id)"
          >
            <template #trigger>
              <button class="session-item-delete" @click.stop>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </template>
            {{ t("terminal.closeSession") }}
          </NPopconfirm>
        </button>
      </div>
    </aside>

    <!-- Main terminal area -->
    <div class="terminal-main">
      <header class="terminal-header">
        <div class="header-left">
          <NButton
            quaternary
            size="small"
            @click="showSessions = !showSessions"
            circle
          >
            <template #icon>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </template>
          </NButton>
          <span v-if="activeSession" class="header-session-title">{{
            activeSession.title
          }}</span>
        </div>
        <div class="header-actions">
          <NButton size="small" @click="createSession">
            <template #icon>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </template>
            {{ t("terminal.newTab") }}
          </NButton>
        </div>
      </header>
      <div class="terminal-container">
        <div ref="terminalRef" class="terminal-xterm" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.terminal-panel {
  display: flex;
  height: 100%;
  position: relative;
}

// ─── Session list ──────────────────────────────────────────────

.session-list {
  width: 220px;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition:
    width $transition-normal,
    opacity $transition-normal;
  overflow: hidden;

  &.collapsed {
    width: 0;
    border-right: none;
    opacity: 0;
    pointer-events: none;
  }

  @media (max-width: $breakpoint-mobile) {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    z-index: 10;
    background: $bg-card;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
    width: 280px;

    &.collapsed {
      transform: translateX(-100%);
      opacity: 0;
    }
  }
}

.session-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  flex-shrink: 0;
}

.session-list-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.session-list-title {
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 6px 12px;
}

.session-empty {
  padding: 16px 10px;
  font-size: 12px;
  color: $text-muted;
  text-align: center;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: none;
  border-radius: $radius-sm;
  cursor: pointer;
  text-align: left;
  color: $text-secondary;
  transition: all $transition-fast;
  margin-bottom: 2px;

  &:hover {
    background: rgba($accent-primary, 0.06);
    color: $text-primary;

    .session-item-delete {
      opacity: 1;
    }
  }

  &.active {
    background: rgba($accent-primary, 0.1);
    color: $text-primary;
    font-weight: 500;
  }

  &.exited {
    opacity: 0.5;
  }
}

.session-item-content {
  flex: 1;
  overflow: hidden;
}

.session-item-title {
  display: block;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.session-item-shell {
  font-size: 10px;
  color: $accent-primary;
  background: rgba($accent-primary, 0.08);
  padding: 0 5px;
  border-radius: 3px;
  line-height: 16px;
}

.session-item-time {
  font-size: 11px;
  color: $text-muted;
}

.session-item-status {
  font-size: 11px;
  color: $text-muted;
  font-style: italic;
}

.session-item-delete {
  flex-shrink: 0;
  opacity: 0.5;
  padding: 2px;
  border: none;
  background: none;
  color: $text-muted;
  cursor: pointer;
  border-radius: 3px;
  transition: all $transition-fast;

  &:hover {
    color: $error;
    background: rgba($error, 0.1);
  }
}

.session-close-btn {
  display: none;
  border: none;
  background: none;
  cursor: pointer;
  color: $text-secondary;
  padding: 4px;
  border-radius: $radius-sm;

  &:hover {
    background: rgba($accent-primary, 0.06);
  }
}

// ─── Main area ──────────────────────────────────────────────────

.terminal-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 21px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.header-session-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

// ─── Terminal container ─────────────────────────────────────────

.terminal-container {
  flex: 1;
  margin: 10px;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.terminal-xterm {
  flex: 1;
  border-radius: $radius-md;
  overflow: hidden;
  background-color: #1a1a2e;
  border: 1px solid $border-color;

  :deep(.xterm) {
    height: 100%;
    padding: 8px;
  }

  :deep(.xterm-viewport) {
    overflow-y: scroll !important;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    background-color: transparent !important;
  }

  :deep(.xterm-viewport::-webkit-scrollbar) {
    display: none !important;
  }

  :deep(.xterm-screen) {
    background-color: transparent !important;
  }

  :deep(.xterm-scrollable-element) {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  :deep(.xterm-scrollable-element::-webkit-scrollbar) {
    display: none !important;
  }
}

// ─── Mobile ─────────────────────────────────────────────────────

@media (max-width: $breakpoint-mobile) {
  .session-close-btn {
    display: flex;
  }

  .session-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 9;
    opacity: 0;
    pointer-events: none;
    transition: opacity $transition-fast;

    &.active {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .terminal-header {
    padding: 16px 12px 16px 52px;
  }

  .terminal-container {
    padding: 8px;
  }

  .terminal-xterm {
    left: 0;
    right: 0;
    bottom: 0;
  }
}
</style>

<style lang="scss">
/* Global: xterm scrollbar (scoped :deep can't reach dynamically created elements) */
.xterm .scrollbar {
  width: 6px !important;
  border-radius: 3px !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

.xterm .scrollbar .slider {
  border-radius: 3px !important;
  background: rgba(255, 255, 255, 0.2) !important;
  transition: background 0.15s ease !important;
}

.xterm .scrollbar:hover .slider {
  background: rgba(255, 255, 255, 0.35) !important;
}
</style>
