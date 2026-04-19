// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const mockChatStore = vi.hoisted(() => ({
  sessions: [] as Array<Record<string, any>>,
  activeSessionId: null as string | null,
  activeSession: null as Record<string, any> | null,
  isLoadingSessions: false,
  newChat: vi.fn(),
  switchSession: vi.fn(),
  deleteSession: vi.fn(),
}))

vi.mock('@/stores/hermes/chat', () => ({
  useChatStore: () => mockChatStore,
}))

vi.mock('@/api/hermes/sessions', () => ({
  renameSession: vi.fn(),
}))

vi.mock('@/components/hermes/chat/MessageList.vue', () => ({
  default: {
    template: '<div class="message-list-mock" />',
  },
}))

vi.mock('@/components/hermes/chat/ChatInput.vue', () => ({
  default: {
    template: '<div class="chat-input-mock" />',
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('naive-ui', async () => {
  const actual = await vi.importActual<any>('naive-ui')
  return {
    ...actual,
    useMessage: () => ({
      success: vi.fn(),
      error: vi.fn(),
    }),
  }
})

import ChatPanel from '@/components/hermes/chat/ChatPanel.vue'

function makeSession(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    title: id,
    source: 'api_server',
    messages: [],
    createdAt: 1,
    updatedAt: 1,
    model: 'gpt-4o',
    ...overrides,
  }
}

describe('ChatPanel session list', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()

    const activeDiscord = makeSession('discord-active', {
      title: 'Discord Active',
      source: 'discord',
      createdAt: 100,
      updatedAt: 500,
    })
    const olderDiscord = makeSession('discord-older', {
      title: 'Discord Older',
      source: 'discord',
      createdAt: 200,
      updatedAt: 400,
    })
    const apiSession = makeSession('api-1', {
      title: 'API Session',
      source: 'api_server',
      createdAt: 300,
      updatedAt: 300,
    })

    mockChatStore.sessions = [apiSession, olderDiscord, activeDiscord]
    mockChatStore.activeSessionId = activeDiscord.id
    mockChatStore.activeSession = activeDiscord
    mockChatStore.isLoadingSessions = false
  })

  it('pins the active session group to the top and renders an active indicator', () => {
    const wrapper = mount(ChatPanel, {
      global: {
        stubs: {
          ChatInput: true,
          MessageList: true,
          NButton: true,
          NDropdown: true,
          NInput: true,
          NModal: true,
          NPopconfirm: true,
          NTooltip: true,
        },
      },
    })

    const groupLabels = wrapper.findAll('.session-group-label').map(node => node.text())
    expect(groupLabels[0]).toBe('Discord')

    const sessionTitles = wrapper.findAll('.session-item-title').map(node => node.text())
    expect(sessionTitles.slice(0, 2)).toEqual(['Discord Active', 'Discord Older'])

    const activeIndicator = wrapper.find('.session-item.active .session-item-active-indicator')
    expect(activeIndicator.exists()).toBe(true)
  })
})
