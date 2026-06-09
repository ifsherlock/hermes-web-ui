import { describe, expect, it } from 'vitest'
import { normalizeModelFallbackConfig } from '../../packages/server/src/services/app-config'

describe('model fallback config', () => {
  it('normalizes enabled rules and fallback targets', () => {
    const config = normalizeModelFallbackConfig({
      enabled: true,
      rules: [{
        id: 'main-rule',
        profile: 'default',
        provider: 'openai',
        model: 'gpt-5.5',
        fallbacks: [
          { provider: 'deepseek', model: 'deepseek-v4-flash' },
          { provider: 'openai', model: 'gpt-5.5' },
          { provider: 'deepseek', model: 'deepseek-v4-flash' },
        ],
        retry_on: ['run_failed'],
      }],
    })

    expect(config.enabled).toBe(true)
    expect(config.rules).toHaveLength(1)
    expect(config.rules?.[0]).toMatchObject({
      id: 'main-rule',
      profile: 'default',
      provider: 'openai',
      model: 'gpt-5.5',
      retry_on: ['run_failed'],
    })
    expect(config.rules?.[0].fallbacks).toEqual([
      { provider: 'deepseek', model: 'deepseek-v4-flash' },
    ])
  })

  it('drops unsafe keys and supplies safe defaults', () => {
    const config = normalizeModelFallbackConfig({
      enabled: 'yes',
      rules: [{
        id: 'bad id',
        provider: '__proto__',
        model: 'x',
        fallbacks: [{ provider: 'safe', model: 'model' }],
      }, {
        provider: 'safe',
        model: 'primary',
        fallbacks: [{ provider: 'safe', model: 'backup' }],
        retry_on: ['unknown'],
      }],
    })

    expect(config.enabled).toBe(false)
    expect(config.rules).toHaveLength(1)
    expect(config.rules?.[0].id).toBe('rule_2')
    expect(config.rules?.[0].retry_on).toEqual(['run_failed', 'empty_output'])
  })
})
