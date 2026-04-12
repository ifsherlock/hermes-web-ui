<script setup lang="ts">
import { renameSession } from '@/api/sessions'
import { useAppStore } from '@/stores/app'
import { useChatStore } from '@/stores/chat'
import { NButton, NDropdown, NInput, NModal, NPopconfirm, NTooltip, useMessage } from 'naive-ui'
import { computed, nextTick, ref } from 'vue'
import ChatInput from './ChatInput.vue'
import MessageList from './MessageList.vue'

const chatStore = useChatStore()
const appStore = useAppStore()
const message = useMessage()

const showSessions = ref(true)
const showRenameModal = ref(false)
const renameValue = ref('')
const renameSessionId = ref<string | null>(null)
const renameInputRef = ref<InstanceType<typeof NInput> | null>(null)

const sortedSessions = computed(() => {
  return [...chatStore.sessions].sort((a, b) => b.createdAt - a.createdAt)
})

const activeSessionTitle = computed(() =>
  chatStore.activeSession?.title || 'New Chat',
)

const activeSessionSource = computed(() =>
  chatStore.activeSession?.source || '',
)

const sessionModelLabel = computed(() =>
  chatStore.activeSession?.model || appStore.selectedModel || '',
)

const sourceLabel: Record<string, string> = {
  telegram: 'Telegram',
  api_server: 'API Server',
  cli: 'CLI',
  discord: 'Discord',
  slack: 'Slack',
  matrix: 'Matrix',
  whatsapp: 'WhatsApp',
  signal: 'Signal',
  email: 'Email',
  sms: 'SMS',
  dingtalk: 'DingTalk',
  feishu: 'Feishu',
  wecom: 'WeCom',
  weixin: 'WeChat',
  bluebubbles: 'iMessage',
  mattermost: 'Mattermost',
}

function getSourceLabel(source?: string): string {
  if (!source) return ''
  return sourceLabel[source] || source
}

function handleNewChat() {
  chatStore.newChat()
}

function copySessionId(id?: string) {
  const sessionId = id || chatStore.activeSessionId
  if (sessionId) {
    navigator.clipboard.writeText(sessionId)
    message.success('Copied')
  }
}

function handleDeleteSession(id: string) {
  chatStore.deleteSession(id)
  message.success('Session deleted')
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Context menu
const contextMenuOptions = [
  { label: 'Rename', key: 'rename' },
  { label: 'Copy Session ID', key: 'copy-id' },
]
const contextSessionId = ref<string | null>(null)

function handleContextMenu(e: MouseEvent, sessionId: string) {
  e.preventDefault()
  contextSessionId.value = sessionId
  showContextMenu.value = true
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
}

const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function handleContextMenuSelect(key: string) {
  showContextMenu.value = false
  if (!contextSessionId.value) return
  if (key === 'copy-id') {
    copySessionId(contextSessionId.value)
  } else if (key === 'rename') {
    const session = chatStore.sessions.find(s => s.id === contextSessionId.value)
    renameSessionId.value = contextSessionId.value
    renameValue.value = session?.title || ''
    showRenameModal.value = true
    nextTick(() => {
      renameInputRef.value?.focus()
    })
  }
}

function handleClickOutside() {
  showContextMenu.value = false
}

async function handleRenameConfirm() {
  if (!renameSessionId.value || !renameValue.value.trim()) return
  const ok = await renameSession(renameSessionId.value, renameValue.value.trim())
  if (ok) {
    const session = chatStore.sessions.find(s => s.id === renameSessionId.value)
    if (session) session.title = renameValue.value.trim()
    if (chatStore.activeSession?.id === renameSessionId.value) {
      chatStore.activeSession.title = renameValue.value.trim()
    }
    message.success('Renamed')
  } else {
    message.error('Rename failed')
  }
  showRenameModal.value = false
}
</script>

<template>
  <div class="chat-panel">
    <!-- Session List -->
    <aside class="session-list" :class="{ collapsed: !showSessions }">
      <div class="session-list-header">
        <span v-if="showSessions" class="session-list-title">Sessions</span>
        <NButton quaternary size="tiny" @click="handleNewChat" circle>
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </template>
        </NButton>
      </div>
      <div v-if="showSessions" class="session-items">
        <div v-if="chatStore.isLoadingSessions && sortedSessions.length === 0" class="session-loading">Loading...</div>
        <div v-else-if="sortedSessions.length === 0" class="session-empty">No sessions</div>
        <button
          v-for="s in sortedSessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === chatStore.activeSessionId }"
          @click="chatStore.switchSession(s.id)"
          @contextmenu="handleContextMenu($event, s.id)"
        >
          <div class="session-item-content">
            <span class="session-item-title">{{ s.title }}</span>
            <span class="session-item-meta">
              <span v-if="s.model" class="session-item-model">{{ s.model }}</span>
              <!-- <span v-if="s.source" class="session-item-source">{{ getSourceLabel(s.source) }}</span> -->
              <span class="session-item-time">{{ formatTime(s.createdAt) }}</span>
            </span>
          </div>
          <NPopconfirm
            v-if="s.id !== chatStore.activeSessionId || sortedSessions.length > 1"
            @positive-click="handleDeleteSession(s.id)"
          >
            <template #trigger>
              <button class="session-item-delete" @click.stop>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </template>
            Delete this session?
          </NPopconfirm>
        </button>
      </div>
    </aside>

    <!-- Context Menu -->
    <NDropdown
      placement="bottom-start"
      trigger="manual"
      :x="contextMenuX"
      :y="contextMenuY"
      :options="contextMenuOptions"
      :show="showContextMenu"
      @select="handleContextMenuSelect"
      @clickoutside="handleClickOutside"
    />

    <!-- Rename Modal -->
    <NModal
      v-model:show="showRenameModal"
      preset="dialog"
      title="Rename Session"
      positive-text="OK"
      negative-text="Cancel"
      @positive-click="handleRenameConfirm"
    >
      <NInput
        ref="renameInputRef"
        v-model:value="renameValue"
        placeholder="Enter new title"
        @keydown.enter="handleRenameConfirm"
      />
    </NModal>

    <!-- Chat Area -->
    <div class="chat-main">
      <header class="chat-header">
        <div class="header-left">
          <NButton quaternary size="small" @click="showSessions = !showSessions" circle>
            <template #icon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </template>
          </NButton>
          <span class="header-session-title">{{ activeSessionTitle }}</span>
          <span v-if="activeSessionSource" class="source-badge">{{ getSourceLabel(activeSessionSource) }}</span>
        </div>
        <div class="header-center">
          <span v-if="sessionModelLabel" class="model-badge">{{ sessionModelLabel }}</span>
        </div>
        <div class="header-actions">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton quaternary size="small" @click="copySessionId()" circle>
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </template>
              </NButton>
            </template>
            Copy Session ID
          </NTooltip>
          <NButton size="small" @click="handleNewChat">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </template>
            New Chat
          </NButton>
        </div>
      </header>

      <MessageList />
      <ChatInput />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-panel {
  display: flex;
  height: 100%;
}

.session-list {
  width: 220px;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width $transition-normal, opacity $transition-normal;
  overflow: hidden;

  &.collapsed {
    width: 0;
    border-right: none;
    opacity: 0;
    pointer-events: none;
  }
}

.session-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  flex-shrink: 0;
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

.session-loading,
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

.session-item-time {
  font-size: 11px;
  color: $text-muted;
}

.session-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.session-item-model {
  font-size: 10px;
  color: $accent-primary;
  background: rgba($accent-primary, 0.08);
  padding: 0 5px;
  border-radius: 3px;
  line-height: 16px;
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item-source {
  font-size: 10px;
  color: $text-muted;
  background: rgba($text-muted, 0.1);
  padding: 0 5px;
  border-radius: 3px;
  line-height: 16px;
  flex-shrink: 0;
  white-space: nowrap;
}

.session-item-delete {
  flex-shrink: 0;
  opacity: 0;
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

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
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

.header-center {
  flex-shrink: 0;
  max-width: 240px;
  min-width: 140px;
}

.header-session-title {
  font-size: 14px;
  font-weight: 500;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-badge {
  font-size: 10px;
  color: $text-muted;
  background: rgba($text-muted, 0.12);
  padding: 1px 7px;
  border-radius: 8px;
  flex-shrink: 0;
  white-space: nowrap;
  line-height: 16px;
}

.model-badge {
  font-size: 11px;
  color: $text-muted;
  background: rgba($accent-primary, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid $border-color;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>
