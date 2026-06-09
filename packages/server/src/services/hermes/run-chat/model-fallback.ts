import {
  normalizeModelFallbackConfig,
  readAppConfig,
  type ModelFallbackReason,
  type ModelFallbackTarget,
} from '../../app-config'
import type { RunModelGroup } from './model-config'

export interface ModelFallbackAttempt extends ModelFallbackTarget {
  index: number
  primary: boolean
  retry_on?: ModelFallbackReason[]
}

function targetKey(target: ModelFallbackTarget): string {
  return `${target.provider}\n${target.model}`
}

function hasModelInGroups(groups: RunModelGroup[] | undefined, target: ModelFallbackTarget): boolean {
  if (!groups?.length) return true
  const group = groups.find(item => item.provider === target.provider)
  return Array.isArray(group?.models) && group.models.includes(target.model)
}

function reasonsInclude(reasons: ModelFallbackReason[] | undefined, reason: ModelFallbackReason): boolean {
  return !reasons?.length || reasons.includes(reason)
}

export async function resolveModelFallbackAttempts(options: {
  profile: string
  provider: string
  model: string
  reason?: ModelFallbackReason
  modelGroups?: RunModelGroup[]
}): Promise<ModelFallbackAttempt[]> {
  const primary = {
    provider: String(options.provider || '').trim(),
    model: String(options.model || '').trim(),
  }
  if (!primary.provider || !primary.model) return [{ ...primary, index: 0, primary: true }]

  const appConfig = await readAppConfig()
  const config = normalizeModelFallbackConfig(appConfig.modelFallback)
  if (!config.enabled) return [{ ...primary, index: 0, primary: true }]

  const rules = (config.rules || [])
    .filter(rule => rule.enabled !== false)
    .filter(rule => rule.provider === primary.provider && rule.model === primary.model)
    .filter(rule => !rule.profile || rule.profile === options.profile)
    .filter(rule => !options.reason || reasonsInclude(rule.retry_on, options.reason))
    .sort((a, b) => Number(!!b.profile) - Number(!!a.profile))

  const rule = rules[0]
  if (!rule?.fallbacks.length) return [{ ...primary, index: 0, primary: true }]

  const seen = new Set<string>([targetKey(primary)])
  const fallbacks = rule.fallbacks
    .filter(target => hasModelInGroups(options.modelGroups, target))
    .filter(target => {
      const key = targetKey(target)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return [primary, ...fallbacks].map((target, index) => ({
    ...target,
    index,
    primary: index === 0,
    retry_on: rule.retry_on,
  }))
}
