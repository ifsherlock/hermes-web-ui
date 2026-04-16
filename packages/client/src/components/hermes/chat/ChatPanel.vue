<script setup lang="ts">
import { renameSession } from '@/api/hermes/sessions'
import { useChatStore, type Session } from '@/stores/hermes/chat'
import { NButton, NDropdown, NInput, NModal, NPopconfirm, NTooltip, useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ChatInput from './ChatInput.vue'
import MessageList from './MessageList.vue'

const chatStore = useChatStore()
const message = useMessage()
const { t } = useI18n()

const showSessions = ref(true)
let mobileQuery: MediaQueryList | null = null

function handleSessionClick(sessionId: string) {
  chatStore.switchSession(sessionId)
  if (mobileQuery?.matches) showSessions.value = false
}

function handleMobileChange(e: MediaQueryListEvent | MediaQueryList) {
  if (e.matches && showSessions.value) {
    showSessions.value = false
  }
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 768px)')
  handleMobileChange(mobileQuery)
  mobileQuery.addEventListener('change', handleMobileChange)
})

onUnmounted(() => {
  mobileQuery?.removeEventListener('change', handleMobileChange)
})
const showRenameModal = ref(false)
const renameValue = ref('')
const renameSessionId = ref<string | null>(null)
const renameInputRef = ref<InstanceType<typeof NInput> | null>(null)
const collapsedGroups = ref<Set<string>>(new Set(JSON.parse(localStorage.getItem('hermes_collapsed_groups') || '[]')))

const sourceLabelKeys: Record<string, string> = {
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
  cron: 'Cron',
}

function getSourceLabel(source?: string): string {
  if (!source) return ''
  return sourceLabelKeys[source] || source
}

// Source sort order: api_server first, cron last, others alphabetical
function sourceSortKey(source: string): number {
  if (source === 'api_server') return -1
  if (source === 'cron') return 999
  return 0
}

// Group sessions by source, with sort order
interface SessionGroup {
  source: string
  label: string
  sessions: Session[]
}

const groupedSessions = computed<SessionGroup[]>(() => {
  const all = [...chatStore.sessions].sort((a, b) => b.createdAt - a.createdAt)

  const map = new Map<string, Session[]>()
  for (const s of all) {
    const key = s.source || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }

  const keys = [...map.keys()].sort((a, b) => {
    const ka = sourceSortKey(a)
    const kb = sourceSortKey(b)
    if (ka !== kb) return ka - kb
    return a.localeCompare(b)
  })

  return keys.map(key => ({
    source: key,
    label: key ? getSourceLabel(key) : t('chat.other'),
    sessions: map.get(key)!,
  }))
})

function toggleGroup(source: string) {
  const isExpanded = !collapsedGroups.value.has(source)
  if (isExpanded) {
    collapsedGroups.value = new Set([...collapsedGroups.value, source])
  } else {
    collapsedGroups.value = new Set(
      groupedSessions.value.map(g => g.source).filter(s => s !== source)
    )
    // Auto-select the first session in the expanded group
    const group = groupedSessions.value.find(g => g.source === source)
    if (group?.sessions.length) {
      chatStore.switchSession(group.sessions[0].id)
    }
  }
  localStorage.setItem('hermes_collapsed_groups', JSON.stringify([...collapsedGroups.value]))
}

// Ensure the active session's group is expanded
watch(groupedSessions, (groups) => {
  if (localStorage.getItem('hermes_collapsed_groups') !== null) {
    // Has saved state — still ensure active session's group is visible
    const activeSource = chatStore.activeSession?.source
    if (activeSource && collapsedGroups.value.has(activeSource)) {
      collapsedGroups.value = new Set([...collapsedGroups.value].filter(s => s !== activeSource))
      localStorage.setItem('hermes_collapsed_groups', JSON.stringify([...collapsedGroups.value]))
    }
    return
  }
  // No saved state: expand only the first group
  collapsedGroups.value = new Set(groups.slice(1).map(g => g.source))
  localStorage.setItem('hermes_collapsed_groups', JSON.stringify([...collapsedGroups.value]))
}, { once: true })

const activeSessionTitle = computed(() =>
  chatStore.activeSession?.title || t('chat.newChat'),
)

const totalTokens = computed(() => {
  const input = chatStore.activeSession?.inputTokens ?? 0
  const output = chatStore.activeSession?.outputTokens ?? 0
  return input + output
})

const MODEL_CONTEXT: Record<string, number> = {
  'claude-opus-4': 200000,
  'claude-sonnet-4': 200000,
  'claude-haiku-4': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-3.5-haiku': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'o1': 200000,
  'o1-mini': 128000,
  'o3': 200000,
  'o3-mini': 200000,
  'o4-mini': 200000,
  'deepseek-chat': 65536,
  'deepseek-reasoner': 65536,
  'gemini-2.5-pro': 1000000,
  'gemini-2.5-flash': 1000000,
  'gemini-2.0-flash': 1000000,
  'glm-4-plus': 128000,
  'glm-4': 128000,
  'qwen-max': 128000,
  'qwen-plus': 128000,
  'qwen-turbo': 128000,
}

const contextWindow = computed(() => {
  const model = chatStore.activeSession?.model || ''
  for (const [key, val] of Object.entries(MODEL_CONTEXT)) {
    if (model.includes(key)) return val
  }
  return null
})

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

const activeSessionSource = computed(() =>
  chatStore.activeSession?.source || '',
)

function handleNewChat() {
  chatStore.newChat()
}

function copySessionId(id?: string) {
  const sessionId = id || chatStore.activeSessionId
  if (sessionId) {
    navigator.clipboard.writeText(sessionId)
    message.success(t('common.copied'))
  }
}

function handleDeleteSession(id: string) {
  chatStore.deleteSession(id)
  message.success(t('chat.sessionDeleted'))
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Context menu
const contextMenuOptions = computed(() => [
  { label: t('chat.rename'), key: 'rename' },
  { label: t('chat.copySessionId'), key: 'copy-id' },
])
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
    message.success(t('chat.renamed'))
  } else {
    message.error(t('chat.renameFailed'))
  }
  showRenameModal.value = false
}
</script>

<template>
  <div class="chat-panel">
    <!-- Session List -->
    <div class="session-backdrop" :class="{ active: showSessions }" @click="showSessions = false" />
    <aside class="session-list" :class="{ collapsed: !showSessions }">
      <div class="session-list-header">
        <span v-if="showSessions" class="session-list-title">{{ t('chat.sessions') }}</span>
        <div class="session-list-actions">
          <button class="session-close-btn" @click="showSessions = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <NButton quaternary size="tiny" @click="handleNewChat" circle>
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </template>
        </NButton>
        </div>
      </div>
      <div v-if="showSessions" class="session-items">
        <div v-if="chatStore.isLoadingSessions && chatStore.sessions.length === 0" class="session-loading">{{ t('common.loading') }}</div>
        <div v-else-if="chatStore.sessions.length === 0" class="session-empty">{{ t('chat.noSessions') }}</div>
        <template v-for="group in groupedSessions" :key="group.source">
          <div class="session-group-header" @click="toggleGroup(group.source)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="group-chevron" :class="{ collapsed: collapsedGroups.has(group.source) }"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="session-group-label">{{ group.label }}</span>
            <span class="session-group-count">{{ group.sessions.length }}</span>
          </div>
          <template v-if="!collapsedGroups.has(group.source)">
            <button
              v-for="s in group.sessions"
              :key="s.id"
              class="session-item"
              :class="{ active: s.id === chatStore.activeSessionId }"
              @click="handleSessionClick(s.id)"
              @contextmenu="handleContextMenu($event, s.id)"
            >
              <div class="session-item-content">
                <span class="session-item-title">{{ s.title }}</span>
                <span class="session-item-meta">
                  <span v-if="s.model" class="session-item-model">{{ s.model }}</span>
                  <span class="session-item-time">{{ formatTime(s.createdAt) }}</span>
                </span>
              </div>
              <NPopconfirm
                v-if="s.id !== chatStore.activeSessionId || chatStore.sessions.length > 1"
                @positive-click="handleDeleteSession(s.id)"
              >
                <template #trigger>
                  <button class="session-item-delete" @click.stop>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </template>
                {{ t('chat.deleteSession') }}
              </NPopconfirm>
            </button>
          </template>
        </template>
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
      :title="t('chat.renameSession')"
      :positive-text="t('common.ok')"
      :negative-text="t('common.cancel')"
      @positive-click="handleRenameConfirm"
    >
      <NInput
        ref="renameInputRef"
        v-model:value="renameValue"
        :placeholder="t('chat.enterNewTitle')"
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
        <div class="header-actions">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton quaternary size="small" @click="copySessionId()" circle>
                <template #icon>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </template>
              </NButton>
            </template>
            {{ t('chat.copySessionId') }}
          </NTooltip>
          <NButton size="small" @click="handleNewChat">
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </template>
            {{ t('chat.newChat') }}
          </NButton>
        </div>
      </header>

      <MessageList />
      <div v-if="contextWindow !== null" class="context-info">
        <span>{{ formatTokens(totalTokens) }} / {{ formatTokens(contextWindow) }}</span>
      </div>
      <ChatInput />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.chat-panel {
  display: flex;
  height: 100%;
  position: relative;
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

.session-list-title {
  font-size: 12px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-group-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px 4px;
  cursor: pointer;
  user-select: none;
}

.group-chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
  transform: rotate(90deg);

  &.collapsed {
    transform: rotate(0deg);
  }
}

.session-group-label {
  font-size: 10px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-group-count {
  font-size: 10px;
  color: $text-muted;
  font-weight: 400;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.context-info {
  padding: 0 20px 4px;
  font-size: 11px;
  color: $text-muted;
  flex-shrink: 0;
}

@media (max-width: $breakpoint-mobile) {
  .chat-header {
    padding: 16px 12px 16px 52px;
  }

  .context-info {
    padding: 0 12px 4px;
  }
}
</style>
