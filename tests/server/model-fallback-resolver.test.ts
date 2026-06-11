import { beforeEach, describe, expect, it, vi } from 'vitest'

const readAppConfigMock = vi.hoisted(() => vi.fn())

vi.mock('../../packages/server/src/services/app-config', async importOriginal => {
  const actual = await importOriginal<typeof import('../../packages/server/src/services/app-config')>()
  return {
    ...actual,
    readAppConfig: readAppConfigMock,
  }
})

import { resolveModelFallbackAttempts } from '../../packages/server/src/services/hermes/run-chat/model-fallback'

const modelGroups = [
  { provider: 'openai', models: ['gpt-5.5'] },
  { provider: 'deepseek', models: ['deepseek-v4-flash'] },
  { provider: 'anthropic', models: ['claude-sonnet'] },
  { provider: 'mimo', models: ['mimo-v2-pro'] },
]

describe('model fallback resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the default fallback chain for any primary model and skips the primary itself', async () => {
    readAppConfigMock.mockResolvedValue({
      modelFallback: {
        enabled: true,
        fallbacks: [
          { provider: 'openai', model: 'gpt-5.5' },
          { provider: 'deepseek', model: 'deepseek-v4-flash' },
          { provider: 'missing', model: 'missing-model' },
        ],
      },
    })

    const attempts = await resolveModelFallbackAttempts({
      profile: 'default',
      provider: 'openai',
      model: 'gpt-5.5',
      modelGroups,
    })

    expect(attempts.map(item => `${item.provider}/${item.model}`)).toEqual([
      'openai/gpt-5.5',
      'deepseek/deepseek-v4-flash',
    ])
  })

  it('prefers specific model rules over provider and global fallback chains', async () => {
    readAppConfigMock.mockResolvedValue({
      modelFallback: {
        enabled: true,
        fallbacks: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
        rules: [{
          id: 'provider',
          scope: 'provider',
          provider: 'openai',
          fallbacks: [{ provider: 'anthropic', model: 'claude-sonnet' }],
        }, {
          id: 'model',
          scope: 'model',
          provider: 'openai',
          model: 'gpt-5.5',
          fallbacks: [{ provider: 'mimo', model: 'mimo-v2-pro' }],
        }],
      },
    })

    const attempts = await resolveModelFallbackAttempts({
      profile: 'default',
      provider: 'openai',
      model: 'gpt-5.5',
      modelGroups,
    })

    expect(attempts.map(item => `${item.provider}/${item.model}`)).toEqual([
      'openai/gpt-5.5',
      'mimo/mimo-v2-pro',
    ])
  })

  it('uses profile scoped rules before the global default chain', async () => {
    readAppConfigMock.mockResolvedValue({
      modelFallback: {
        enabled: true,
        fallbacks: [{ provider: 'deepseek', model: 'deepseek-v4-flash' }],
        rules: [{
          id: 'profile',
          scope: 'profile',
          profile: 'coding',
          fallbacks: [{ provider: 'anthropic', model: 'claude-sonnet' }],
        }],
      },
    })

    const attempts = await resolveModelFallbackAttempts({
      profile: 'coding',
      provider: 'mimo',
      model: 'mimo-v2-pro',
      modelGroups,
    })

    expect(attempts.map(item => `${item.provider}/${item.model}`)).toEqual([
      'mimo/mimo-v2-pro',
      'anthropic/claude-sonnet',
    ])
  })
})
