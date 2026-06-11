import {
  normalizeModelFallbackConfig,
  readAppConfig,
  type ModelFallbackReason,
  type ModelFallbackRule,
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

function fallbackRuleScore(rule: ModelFallbackRule, primary: ModelFallbackTarget, profile: string): number {
  if (rule.enabled === false) return -1
  if (rule.profile && rule.profile !== profile) return -1

  const scope = rule.scope || (rule.provider && rule.model ? 'model' : rule.provider ? 'provider' : 'profile')
  const profileBonus = rule.profile ? 10 : 0
  if (scope === 'model') {
    return rule.provider === primary.provider && rule.model === primary.model ? 300 + profileBonus : -1
  }
  if (scope === 'provider') {
    return rule.provider === primary.provider ? 200 + profileBonus : -1
  }
  if (scope === 'profile') {
    return rule.profile === profile ? 100 + profileBonus : -1
  }
  return -1
}

function filterFallbackTargets(
  primary: ModelFallbackTarget,
  targets: ModelFallbackTarget[],
  groups: RunModelGroup[] | undefined,
): ModelFallbackTarget[] {
  const seen = new Set<string>([targetKey(primary)])
  return targets
    .filter(target => hasModelInGroups(groups, target))
    .filter(target => {
      const key = targetKey(target)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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

  const matchingRule = (config.rules || [])
    .map((rule, order) => ({ rule, order, score: fallbackRuleScore(rule, primary, options.profile) }))
    .filter(item => item.score >= 0)
    .filter(item => !options.reason || reasonsInclude(item.rule.retry_on, options.reason))
    .sort((a, b) => b.score - a.score || a.order - b.order)[0]?.rule

  const fallbackSource = matchingRule?.fallbacks.length
    ? { fallbacks: matchingRule.fallbacks, retry_on: matchingRule.retry_on }
    : { fallbacks: config.fallbacks || [], retry_on: config.retry_on }
  if (!fallbackSource.fallbacks.length) return [{ ...primary, index: 0, primary: true }]

  const fallbacks = filterFallbackTargets(primary, fallbackSource.fallbacks, options.modelGroups)

  return [primary, ...fallbacks].map((target, index) => ({
    ...target,
    index,
    primary: index === 0,
    retry_on: fallbackSource.retry_on,
  }))
}
