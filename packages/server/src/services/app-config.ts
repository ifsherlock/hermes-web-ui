import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { config } from '../config'

const APP_HOME = config.appHome
const APP_CONFIG_FILE = join(APP_HOME, 'config.json')

export interface ModelVisibilityRule {
  mode: 'all' | 'include'
  models: string[]
}

export interface GatewayAutoStartConfig {
  enabled?: boolean
  include?: string[]
  exclude?: string[]
}

export type ModelFallbackReason = 'run_failed' | 'empty_output'

export interface ModelFallbackTarget {
  provider: string
  model: string
}

export interface ModelFallbackRule {
  id: string
  enabled?: boolean
  scope?: 'model' | 'provider' | 'profile'
  profile?: string
  provider?: string
  model?: string
  fallbacks: ModelFallbackTarget[]
  retry_on?: ModelFallbackReason[]
}

export interface ModelFallbackConfig {
  enabled?: boolean
  fallbacks?: ModelFallbackTarget[]
  retry_on?: ModelFallbackReason[]
  rules?: ModelFallbackRule[]
}

function normalizeProfileList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  const names: string[] = []
  for (const value of values) {
    const name = String(value || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

export function normalizeGatewayAutoStartConfig(value: unknown): GatewayAutoStartConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const normalized: GatewayAutoStartConfig = {}

  if (typeof raw.enabled === 'boolean') normalized.enabled = raw.enabled
  if (Array.isArray(raw.include)) normalized.include = normalizeProfileList(raw.include)
  if (Array.isArray(raw.exclude)) normalized.exclude = normalizeProfileList(raw.exclude)

  return normalized
}

function normalizeConfigString(value: unknown, maxLength = 256): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength)
}

function isSafeConfigKey(value: string): boolean {
  return !!value &&
    value !== '__proto__' &&
    value !== 'prototype' &&
    value !== 'constructor'
}

function normalizeFallbackReasons(value: unknown): ModelFallbackReason[] {
  const allowed = new Set<ModelFallbackReason>(['run_failed', 'empty_output'])
  const raw = Array.isArray(value) ? value : ['run_failed', 'empty_output']
  const reasons = raw
    .map(item => String(item || '').trim())
    .filter((item): item is ModelFallbackReason => allowed.has(item as ModelFallbackReason))
  return reasons.length ? Array.from(new Set(reasons)) : ['run_failed', 'empty_output']
}

function normalizeFallbackTarget(value: unknown): ModelFallbackTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const provider = normalizeConfigString(raw.provider)
  const model = normalizeConfigString(raw.model, 512)
  if (!isSafeConfigKey(provider) || !isSafeConfigKey(model)) return null
  return { provider, model }
}

function dedupeFallbackTargets(values: unknown[], primary?: ModelFallbackTarget): ModelFallbackTarget[] {
  const seen = new Set<string>()
  const targets: ModelFallbackTarget[] = []
  for (const value of values) {
    const target = normalizeFallbackTarget(value)
    if (!target) continue
    if (primary && target.provider === primary.provider && target.model === primary.model) continue
    const key = `${target.provider}\n${target.model}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push(target)
  }
  return targets
}

function normalizeFallbackScope(value: unknown, provider: string, model: string, profile: string): ModelFallbackRule['scope'] {
  if (value === 'provider' || value === 'profile' || value === 'model') return value
  if (provider && model) return 'model'
  if (provider) return 'provider'
  if (profile) return 'profile'
  return 'model'
}

export function normalizeModelFallbackConfig(value: unknown): ModelFallbackConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { enabled: false, fallbacks: [], retry_on: ['run_failed', 'empty_output'], rules: [] }
  const raw = value as Record<string, unknown>
  const rulesInput = Array.isArray(raw.rules) ? raw.rules : []
  const rules: ModelFallbackRule[] = []
  const seenIds = new Set<string>()
  const globalFallbacks = dedupeFallbackTargets(Array.isArray(raw.fallbacks) ? raw.fallbacks : [])

  for (let index = 0; index < rulesInput.length; index += 1) {
    const item = rulesInput[index]
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const rule = item as Record<string, unknown>
    const profile = normalizeConfigString(rule.profile, 128)
    const provider = normalizeConfigString(rule.provider)
    const model = normalizeConfigString(rule.model, 512)
    const scope = normalizeFallbackScope(rule.scope, provider, model, profile)
    if (profile && !isSafeConfigKey(profile)) continue
    if ((scope === 'model' || scope === 'provider') && !isSafeConfigKey(provider)) continue
    if (scope === 'model' && !isSafeConfigKey(model)) continue

    let id = normalizeConfigString(rule.id, 80).replace(/[^A-Za-z0-9_.:-]/g, '')
    if (!id) id = `rule_${index + 1}`
    while (seenIds.has(id)) id = `${id}_${index + 1}`
    seenIds.add(id)

    const normalizedRule: ModelFallbackRule = {
      id,
      enabled: rule.enabled !== false,
      scope,
      profile: profile || undefined,
      provider: scope === 'model' || scope === 'provider' ? provider : undefined,
      model: scope === 'model' ? model : undefined,
      fallbacks: dedupeFallbackTargets(
        Array.isArray(rule.fallbacks) ? rule.fallbacks : [],
        scope === 'model' ? { provider, model } : undefined,
      ),
      retry_on: normalizeFallbackReasons(rule.retry_on),
    }
    rules.push(normalizedRule)
  }

  return {
    enabled: raw.enabled === true,
    fallbacks: globalFallbacks,
    retry_on: normalizeFallbackReasons(raw.retry_on),
    rules,
  }
}

export interface AppConfig {
  // Whether GitHub Copilot has been explicitly added by the user in web-ui.
  // Default false: even when COPILOT_GITHUB_TOKEN / gh-cli / apps.json can
  // resolve a token, the Copilot provider is hidden until the user opts in
  // via "Add Provider". Mirrors how the user manages Codex/Nous: the web-ui
  // owns the provider list, system credentials are merely a fallback source.
  copilotEnabled?: boolean

  // Web UI-only model display aliases. Keys are provider -> canonical model ID -> display label.
  // These aliases never replace the canonical model ID sent back to Hermes.
  modelAliases?: Record<string, Record<string, string>>

  // Web UI-only manually entered model IDs. Keys are provider -> model IDs.
  // This lets users persist provider-supported models that are absent from a
  // provider catalog response without changing Hermes Agent config.yaml.
  customModels?: Record<string, string[]>

  // Web UI-only model picker visibility. This filters what the WUI exposes in
  // its sidebar/model pages and never renames or rewrites Hermes canonical
  // provider/model IDs. Hermes CLI config remains the upstream source of truth.
  modelVisibility?: Record<string, ModelVisibilityRule>

  // Web UI startup policy for automatically starting Hermes API gateways.
  // Defaults to legacy behavior: all local profiles are eligible. This is a
  // Web UI-level setting, not the active Hermes profile's config.yaml.
  gatewayAutoStart?: GatewayAutoStartConfig

  // Web UI-only runtime fallback model chains. These rules are evaluated by
  // chat-run before surfacing a no-output/failed model call to the user.
  modelFallback?: ModelFallbackConfig
}

let cache: AppConfig | null = null

export async function readAppConfig(): Promise<AppConfig> {
  if (cache) return cache
  try {
    const raw = await readFile(APP_CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as AppConfig
    cache = parsed
    return parsed
  } catch {
    cache = {}
    return cache
  }
}

export async function writeAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readAppConfig()
  const merged: AppConfig = { ...current, ...patch }
  await mkdir(APP_HOME, { recursive: true })
  await writeFile(APP_CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 })
  cache = merged
  return merged
}

export function __resetAppConfigCacheForTest(): void {
  cache = null
}
