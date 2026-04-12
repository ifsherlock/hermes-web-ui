import { startRun, streamRunEvents, type ChatMessage, type RunEvent } from '@/api/chat'
import { deleteSession as deleteSessionApi, fetchSession, fetchSessions, type HermesMessage, type SessionSummary } from '@/api/sessions'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAppStore } from './app'

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  file?: File
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolName?: string
  toolPreview?: string
  toolArgs?: string
  toolResult?: string
  toolStatus?: 'running' | 'done' | 'error'
  isStreaming?: boolean
  attachments?: Attachment[]
}

export interface Session {
  id: string
  title: string
  source?: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  model?: string
  provider?: string
  messageCount?: number
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

async function uploadFiles(attachments: Attachment[]): Promise<{ name: string; path: string }[]> {
  if (attachments.length === 0) return []
  const formData = new FormData()
  for (const att of attachments) {
    if (att.file) formData.append('file', att.file, att.name)
  }
  const res = await fetch('/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json() as { files: { name: string; path: string }[] }
  return data.files
}

function mapHermesMessages(msgs: HermesMessage[]): Message[] {
  // Build lookups from assistant messages with tool_calls
  const toolNameMap = new Map<string, string>()
  const toolArgsMap = new Map<string, string>()
  for (const msg of msgs) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.id) {
          if (tc.function?.name) toolNameMap.set(tc.id, tc.function.name)
          if (tc.function?.arguments) toolArgsMap.set(tc.id, tc.function.arguments)
        }
      }
    }
  }

  const result: Message[] = []
  for (const msg of msgs) {
    // Skip assistant messages that only contain tool_calls (no meaningful content)
    if (msg.role === 'assistant' && msg.tool_calls?.length && !msg.content?.trim()) {
      // Emit a tool.started message for each tool call
      for (const tc of msg.tool_calls) {
        result.push({
          id: String(msg.id) + '_' + tc.id,
          role: 'tool',
          content: '',
          timestamp: Math.round(msg.timestamp * 1000),
          toolName: tc.function?.name || 'Tool',
          toolArgs: tc.function?.arguments || undefined,
          toolStatus: 'done',
        })
      }
      continue
    }

    // Tool result messages
    if (msg.role === 'tool') {
      const tcId = msg.tool_call_id || ''
      const toolName = msg.tool_name || toolNameMap.get(tcId) || 'Tool'
      const toolArgs = toolArgsMap.get(tcId) || undefined
      // Extract a short preview from the content
      let preview = ''
      if (msg.content) {
        try {
          const parsed = JSON.parse(msg.content)
          preview = parsed.url || parsed.title || parsed.preview || parsed.summary || ''
        } catch {
          preview = msg.content.slice(0, 80)
        }
      }
      // Find and remove the matching placeholder from tool_calls above
      const placeholderIdx = result.findIndex(
        m => m.role === 'tool' && m.toolName === toolName && !m.toolResult && m.id.includes('_' + tcId)
      )
      if (placeholderIdx !== -1) {
        result.splice(placeholderIdx, 1)
      }
      result.push({
        id: String(msg.id),
        role: 'tool',
        content: '',
        timestamp: Math.round(msg.timestamp * 1000),
        toolName,
        toolArgs,
        toolPreview: preview.slice(0, 100) || undefined,
        toolResult: msg.content || undefined,
        toolStatus: 'done',
      })
      continue
    }

    // Normal user/assistant messages
    result.push({
      id: String(msg.id),
      role: msg.role,
      content: msg.content || '',
      timestamp: Math.round(msg.timestamp * 1000),
    })
  }
  return result
}

function mapHermesSession(s: SessionSummary): Session {
  return {
    id: s.id,
    title: s.title || 'New Chat',
    source: s.source || undefined,
    messages: [],
    createdAt: Math.round(s.started_at * 1000),
    updatedAt: Math.round((s.ended_at || s.started_at) * 1000),
    model: s.model,
    provider: (s as any).billing_provider || '',
    messageCount: s.message_count,
  }
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<Session[]>([])
  const activeSessionId = ref<string | null>(null)
  const isStreaming = ref(false)
  const abortController = ref<AbortController | null>(null)
  const isLoadingSessions = ref(false)
  const isLoadingMessages = ref(false)

  const activeSession = ref<Session | null>(null)
  const messages = ref<Message[]>([])

  async function loadSessions() {
    isLoadingSessions.value = true
    try {
      const list = await fetchSessions()
      sessions.value = list.map(mapHermesSession)
      // Backfill titles from first user message for sessions with null title
      const nullTitleSessions = sessions.value.filter(s => s.title === 'New Chat')
      if (nullTitleSessions.length > 0) {
        await Promise.allSettled(
          nullTitleSessions.map(async (s) => {
            const detail = await fetchSession(s.id)
            if (detail?.messages) {
              const firstUser = detail.messages.find(m => m.role === 'user')
              if (firstUser) {
                const t = firstUser.content.slice(0, 40)
                s.title = t + (firstUser.content.length > 40 ? '...' : '')
              }
            }
          })
        )
      }
      // Auto-select the most recent session
      if (!activeSessionId.value && sessions.value.length > 0) {
        await switchSession(sessions.value[0].id)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      isLoadingSessions.value = false
    }
  }

  function createSession(): Session {
    const session: Session = {
      id: uid(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sessions.value.unshift(session)
    return session
  }

  async function switchSession(sessionId: string) {
    activeSessionId.value = sessionId
    activeSession.value = sessions.value.find(s => s.id === sessionId) || null

    // If session has no messages loaded, fetch from API
    if (activeSession.value && activeSession.value.messages.length === 0) {
      isLoadingMessages.value = true
      try {
        const detail = await fetchSession(sessionId)
        if (detail && detail.messages) {
          const mapped = mapHermesMessages(detail.messages)
          activeSession.value.messages = mapped
          // Update title: use Hermes title, or fallback to first user message
          if (detail.title) {
            activeSession.value.title = detail.title
          } else {
            const firstUser = mapped.find(m => m.role === 'user')
            if (firstUser) {
              const t = firstUser.content.slice(0, 40)
              activeSession.value.title = t + (firstUser.content.length > 40 ? '...' : '')
            }
          }
        }
      } catch (err) {
        console.error('Failed to load session messages:', err)
      } finally {
        isLoadingMessages.value = false
      }
    }

    messages.value = activeSession.value ? [...activeSession.value.messages] : []
  }

  function newChat() {
    if (isStreaming.value) return
    const session = createSession()
    // Inherit current global model
    const appStore = useAppStore()
    session.model = appStore.selectedModel || undefined
    switchSession(session.id)
  }

  async function switchSessionModel(modelId: string, provider?: string) {
    if (!activeSession.value) return
    activeSession.value.model = modelId
    activeSession.value.provider = provider || ''
    // If provider changed, update global config too (Hermes requires it)
    if (provider) {
      const { useAppStore } = await import('./app')
      await useAppStore().switchModel(modelId, provider)
    }
  }

  async function deleteSession(sessionId: string) {
    await deleteSessionApi(sessionId)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    if (activeSessionId.value === sessionId) {
      if (sessions.value.length > 0) {
        await switchSession(sessions.value[0].id)
      } else {
        const session = createSession()
        switchSession(session.id)
      }
    }
  }

  function addMessage(msg: Message) {
    messages.value.push(msg)
  }

  function updateMessage(id: string, update: Partial<Message>) {
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx !== -1) {
      messages.value[idx] = { ...messages.value[idx], ...update }
    }
  }

  function updateSessionTitle() {
    if (!activeSession.value) return
    if (activeSession.value.title === 'New Chat') {
      const firstUser = messages.value.find(m => m.role === 'user')
      if (firstUser) {
        const title = firstUser.attachments?.length
          ? firstUser.attachments.map(a => a.name).join(', ')
          : firstUser.content
        activeSession.value.title = title.slice(0, 40) + (title.length > 40 ? '...' : '')
      }
    }
    activeSession.value.updatedAt = Date.now()
  }

  async function sendMessage(content: string, attachments?: Attachment[]) {
    if ((!content.trim() && !(attachments && attachments.length > 0)) || isStreaming.value) return

    if (!activeSession.value) {
      const session = createSession()
      switchSession(session.id)
    }

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    }
    addMessage(userMsg)
    updateSessionTitle()

    isStreaming.value = true

    try {
      // Build conversation history from past messages
      const history: ChatMessage[] = messages.value
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
        .map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))

      // Upload attachments and build input with file paths
      let inputText = content.trim()
      if (attachments && attachments.length > 0) {
        const uploaded = await uploadFiles(attachments)
        const pathParts = uploaded.map(f => `[File: ${f.name}](${f.path})`)
        inputText = inputText ? inputText + '\n\n' + pathParts.join('\n') : pathParts.join('\n')
      }

      const appStore = useAppStore()
      // Use session-level model if set, otherwise fall back to global
      const sessionModel = activeSession.value?.model || appStore.selectedModel
      const run = await startRun({
        input: inputText,
        conversation_history: history,
        session_id: activeSession.value?.id,
        model: sessionModel || undefined,
      })

      const runId = (run as any).run_id || (run as any).id
      if (!runId) {
        addMessage({
          id: uid(),
          role: 'system',
          content: `Error: startRun returned no run ID. Response: ${JSON.stringify(run)}`,
          timestamp: Date.now(),
        })
        isStreaming.value = false
        return
      }

      // Listen to SSE events
      abortController.value = streamRunEvents(
        runId,
        // onEvent
        (evt: RunEvent) => {
          switch (evt.event) {
            case 'run.started':
              break

            case 'message.delta': {
              const last = messages.value[messages.value.length - 1]
              if (last?.role === 'assistant' && last.isStreaming) {
                last.content += evt.delta || ''
              } else {
                addMessage({
                  id: uid(),
                  role: 'assistant',
                  content: evt.delta || '',
                  timestamp: Date.now(),
                  isStreaming: true,
                })
              }
              break
            }

            case 'tool.started': {
              const last = messages.value[messages.value.length - 1]
              if (last?.isStreaming) {
                updateMessage(last.id, { isStreaming: false })
              }
              addMessage({
                id: uid(),
                role: 'tool',
                content: '',
                timestamp: Date.now(),
                toolName: evt.tool || evt.name,
                toolPreview: evt.preview,
                toolStatus: 'running',
              })
              break
            }

            case 'tool.completed': {
              const toolMsgs = messages.value.filter(
                m => m.role === 'tool' && m.toolStatus === 'running',
              )
              if (toolMsgs.length > 0) {
                const last = toolMsgs[toolMsgs.length - 1]
                updateMessage(last.id, { toolStatus: 'done' })
              }
              break
            }

            case 'run.completed':
              const lastMsg = messages.value[messages.value.length - 1]
              if (lastMsg?.isStreaming) {
                updateMessage(lastMsg.id, { isStreaming: false })
              }
              isStreaming.value = false
              abortController.value = null
              updateSessionTitle()
              break

            case 'run.failed':
              const lastErr = messages.value[messages.value.length - 1]
              if (lastErr?.isStreaming) {
                updateMessage(lastErr.id, {
                  isStreaming: false,
                  content: evt.error ? `Error: ${evt.error}` : 'Run failed',
                  role: 'system',
                })
              } else {
                addMessage({
                  id: uid(),
                  role: 'system',
                  content: evt.error ? `Error: ${evt.error}` : 'Run failed',
                  timestamp: Date.now(),
                })
              }
              messages.value.forEach((m, i) => {
                if (m.role === 'tool' && m.toolStatus === 'running') {
                  messages.value[i] = { ...m, toolStatus: 'error' }
                }
              })
              isStreaming.value = false
              abortController.value = null
              break
          }
        },
        // onDone
        () => {
          const last = messages.value[messages.value.length - 1]
          if (last?.isStreaming) {
            updateMessage(last.id, { isStreaming: false })
          }
          isStreaming.value = false
          abortController.value = null
          updateSessionTitle()
        },
        // onError
        (err) => {
          const last = messages.value[messages.value.length - 1]
          if (last?.isStreaming) {
            updateMessage(last.id, {
              isStreaming: false,
              content: `Error: ${err.message}`,
              role: 'system',
            })
          } else {
            addMessage({
              id: uid(),
              role: 'system',
              content: `Error: ${err.message}`,
              timestamp: Date.now(),
            })
          }
          isStreaming.value = false
          abortController.value = null
        },
      )
    } catch (err: any) {
      addMessage({
        id: uid(),
        role: 'system',
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
      })
      isStreaming.value = false
      abortController.value = null
    }
  }

  function stopStreaming() {
    abortController.value?.abort()
    isStreaming.value = false
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.isStreaming) {
      updateMessage(lastMsg.id, { isStreaming: false })
    }
    abortController.value = null
  }

  // Load sessions on init
  loadSessions()

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    isStreaming,
    isLoadingSessions,
    isLoadingMessages,
    newChat,
    switchSession,
    switchSessionModel,
    deleteSession,
    sendMessage,
    stopStreaming,
    loadSessions,
  }
})
