import Router from '@koa/router'
import { readdir, readFile, stat, writeFile, mkdir, copyFile } from 'fs/promises'
import { join, resolve } from 'path'
import YAML from 'js-yaml'
import { getActiveProfileDir, getActiveConfigPath, getActiveAuthPath, getActiveEnvPath } from '../../services/hermes-profile'
import * as hermesCli from '../../services/hermes-cli'

// --- Provider env var mapping (from hermes providers.py HERMES_OVERLAYS + config.py) ---
// Maps provider key → { api_key_envs: all env var aliases for API key, base_url_env: env var for base URL }
const PROVIDER_ENV_MAP: Record<string, { api_key_env: string; base_url_env: string }> = {
  openrouter: { api_key_env: 'OPENROUTER_API_KEY', base_url_env: 'OPENROUTER_BASE_URL' },
  zai: { api_key_env: 'ZAI_API_KEY', base_url_env: '' },
  'kimi-for-coding': { api_key_env: 'KIMI_API_KEY', base_url_env: '' },
  minimax: { api_key_env: 'MINIMAX_API_KEY', base_url_env: 'MINIMAX_BASE_URL' },
  'minimax-cn': { api_key_env: 'MINIMAX_API_KEY', base_url_env: 'MINIMAX_CN_BASE_URL' },
  deepseek: { api_key_env: 'DEEPSEEK_API_KEY', base_url_env: 'DEEPSEEK_BASE_URL' },
  alibaba: { api_key_env: 'DASHSCOPE_API_KEY', base_url_env: 'DASHSCOPE_BASE_URL' },
  anthropic: { api_key_env: 'ANTHROPIC_API_KEY', base_url_env: '' },
  xai: { api_key_env: 'XAI_API_KEY', base_url_env: 'XAI_BASE_URL' },
  xiaomi: { api_key_env: 'XIAOMI_API_KEY', base_url_env: 'XIAOMI_BASE_URL' },
  gemini: { api_key_env: 'GEMINI_API_KEY', base_url_env: '' },
  kilo: { api_key_env: 'KILO_API_KEY', base_url_env: 'KILOCODE_BASE_URL' },
  vercel: { api_key_env: 'AI_GATEWAY_API_KEY', base_url_env: '' },
  opencode: { api_key_env: 'OPENCODE_API_KEY', base_url_env: 'OPENCODE_ZEN_BASE_URL' },
  'opencode-go': { api_key_env: 'OPENCODE_API_KEY', base_url_env: 'OPENCODE_GO_BASE_URL' },
  huggingface: { api_key_env: 'HF_TOKEN', base_url_env: 'HF_BASE_URL' },
}

async function saveEnvValue(key: string, value: string): Promise<void> {
  const envPath = getActiveEnvPath()
  let raw: string
  try {
    raw = await readFile(envPath, 'utf-8')
  } catch {
    raw = ''
  }
  const remove = !value
  const lines = raw.split('\n')
  let found = false
  const result: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') && trimmed.startsWith(`# ${key}=`)) {
      if (!remove) result.push(`${key}=${value}`)
      found = true
    } else {
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1 && trimmed.slice(0, eqIdx).trim() === key) {
        if (!remove) result.push(`${key}=${value}`)
        found = true
      } else {
        result.push(line)
      }
    }
  }
  if (!found && !remove) {
    result.push(`${key}=${value}`)
  }
  let output = result.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '') + '\n'
  await writeFile(envPath, output, 'utf-8')
}

// --- Auth / Credential Pool ---

interface CredentialPoolEntry {
  id: string
  label: string
  base_url: string
  access_token: string
  last_status?: string | null
}

interface AuthJson {
  credential_pool?: Record<string, CredentialPoolEntry[]>
}

const authPath = () => getActiveAuthPath()

async function loadAuthJson(): Promise<AuthJson | null> {
  try {
    const raw = await readFile(authPath(), 'utf-8')
    return JSON.parse(raw) as AuthJson
  } catch {
    return null
  }
}

async function saveAuthJson(auth: AuthJson): Promise<void> {
  await writeFile(authPath(), JSON.stringify(auth, null, 2) + '\n', 'utf-8')
}

async function fetchProviderModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const url = baseUrl.replace(/\/+$/, '') + '/models'
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[available-models] ${baseUrl} returned ${res.status}`)
      return []
    }
    const data = await res.json() as { data?: Array<{ id: string }> }
    if (!Array.isArray(data.data)) {
      console.error(`[available-models] ${baseUrl} returned unexpected format`)
      return []
    }
    return data.data.map(m => m.id).sort()
  } catch (err: any) {
    console.error(`[available-models] ${baseUrl} failed: ${err.message}`)
    return []
  }
}

// --- Hardcoded model catalogs (single source: src/shared/providers.ts) ---
import { buildProviderModelMap } from '../../shared/providers'
const PROVIDER_MODEL_CATALOG = buildProviderModelMap()

export const fsRoutes = new Router()

const hermesDir = () => getActiveProfileDir()

// --- Types ---

interface SkillInfo {
  name: string
  description: string
  enabled: boolean
}

interface SkillCategory {
  name: string
  description: string
  skills: SkillInfo[]
}

// --- Helpers ---

function extractDescription(content: string): string {
  const lines = content.split('\n')
  let inFrontmatter = false
  let bodyStarted = false

  for (const line of lines) {
    if (!bodyStarted && line.trim() === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true
        continue
      } else {
        inFrontmatter = false
        bodyStarted = true
        continue
      }
    }
    if (inFrontmatter) continue
    if (line.trim() === '') continue
    if (line.startsWith('#')) continue
    return line.trim().slice(0, 80)
  }
  return ''
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

async function safeStat(filePath: string): Promise<{ mtime: number } | null> {
  try {
    const s = await stat(filePath)
    return { mtime: Math.round(s.mtimeMs) }
  } catch {
    return null
  }
}

// --- Config YAML helpers ---

const configPath = () => getActiveConfigPath()

async function readConfigYaml(): Promise<Record<string, any>> {
  const raw = await safeReadFile(configPath())
  if (!raw) return {}
  return (YAML.load(raw) as Record<string, any>) || {}
}

async function writeConfigYaml(config: Record<string, any>): Promise<void> {
  const cp = configPath()
  await copyFile(cp, cp + '.bak')
  const yamlStr = YAML.dump(config, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
  })
  await writeFile(cp, yamlStr, 'utf-8')
}

// --- Skills Routes ---

// List all skills grouped by category
fsRoutes.get('/api/hermes/skills', async (ctx) => {
  const skillsDir = join(hermesDir(), 'skills')

  try {
    // Read disabled skills list from config.yaml
    const config = await readConfigYaml()
    const disabledList: string[] = config.skills?.disabled || []

    const entries = await readdir(skillsDir, { withFileTypes: true })
    const categories: SkillCategory[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue

      const catDir = join(skillsDir, entry.name)
      const catDesc = await safeReadFile(join(catDir, 'DESCRIPTION.md'))
      const catDescription = catDesc ? catDesc.trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 100) : ''

      const skillEntries = await readdir(catDir, { withFileTypes: true })
      const skills: SkillInfo[] = []

      for (const se of skillEntries) {
        if (!se.isDirectory()) continue
        const skillMd = await safeReadFile(join(catDir, se.name, 'SKILL.md'))
        if (skillMd) {
          skills.push({
            name: se.name,
            description: extractDescription(skillMd),
            enabled: !disabledList.includes(se.name),
          })
        }
      }

      if (skills.length > 0) {
        categories.push({ name: entry.name, description: catDescription, skills })
      }
    }

    categories.sort((a, b) => a.name.localeCompare(b.name))
    for (const cat of categories) {
      cat.skills.sort((a, b) => a.name.localeCompare(b.name))
    }

    ctx.body = { categories }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: `Failed to read skills directory: ${err.message}` }
  }
})

// Toggle skill enabled/disabled via config.yaml skills.disabled
fsRoutes.put('/api/hermes/skills/toggle', async (ctx) => {
  const { name, enabled } = ctx.request.body as { name?: string; enabled?: boolean }

  if (!name || typeof enabled !== 'boolean') {
    ctx.status = 400
    ctx.body = { error: 'Missing name or enabled flag' }
    return
  }

  try {
    const config = await readConfigYaml()
    if (!config.skills) config.skills = {}
    if (!Array.isArray(config.skills.disabled)) config.skills.disabled = []

    const disabled = config.skills.disabled as string[]
    const idx = disabled.indexOf(name)

    if (enabled) {
      // Enable: remove from disabled list
      if (idx !== -1) disabled.splice(idx, 1)
    } else {
      // Disable: add to disabled list
      if (idx === -1) disabled.push(name)
    }

    await writeConfigYaml(config)
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// List files in a skill directory
async function listFilesRecursive(dir: string, prefix: string): Promise<{ path: string; name: string }[]> {
  const result: { path: string; name: string }[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      result.push(...await listFilesRecursive(join(dir, entry.name), relPath))
    } else {
      result.push({ path: relPath, name: entry.name })
    }
  }
  return result
}

fsRoutes.get('/api/hermes/skills/:category/:skill/files', async (ctx) => {
  const { category, skill } = ctx.params
  const skillDir = join(hermesDir(), 'skills', category, skill)

  try {
    const allFiles = await listFilesRecursive(skillDir, '')
    const files = allFiles.filter(f => f.path !== 'SKILL.md')
    ctx.body = { files }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// Read a specific file under skills/ (must be registered after the /files route)
fsRoutes.get('/api/hermes/skills/{*path}', async (ctx) => {
  const filePath = (ctx.params as any).path
  const hd = hermesDir()
  const fullPath = resolve(join(hd, 'skills', filePath))

  if (!fullPath.startsWith(join(hd, 'skills'))) {
    ctx.status = 403
    ctx.body = { error: 'Access denied' }
    return
  }

  const content = await safeReadFile(fullPath)
  if (content === null) {
    ctx.status = 404
    ctx.body = { error: 'File not found' }
    return
  }

  ctx.body = { content }
})

// --- Memory Routes ---

fsRoutes.get('/api/hermes/memory', async (ctx) => {
  const hd = hermesDir()
  const memoryPath = join(hd, 'memories', 'MEMORY.md')
  const userPath = join(hd, 'memories', 'USER.md')
  const soulPath = join(hd, 'SOUL.md')

  const [memory, user, soul, memoryStat, userStat, soulStat] = await Promise.all([
    safeReadFile(memoryPath),
    safeReadFile(userPath),
    safeReadFile(soulPath),
    safeStat(memoryPath),
    safeStat(userPath),
    safeStat(soulPath),
  ])

  ctx.body = {
    memory: memory || '',
    user: user || '',
    soul: soul || '',
    memory_mtime: memoryStat?.mtime || null,
    user_mtime: userStat?.mtime || null,
    soul_mtime: soulStat?.mtime || null,
  }
})

fsRoutes.post('/api/hermes/memory', async (ctx) => {
  const { section, content } = ctx.request.body as { section: string; content: string }

  if (!section || !content) {
    ctx.status = 400
    ctx.body = { error: 'Missing section or content' }
    return
  }

  if (section !== 'memory' && section !== 'user' && section !== 'soul') {
    ctx.status = 400
    ctx.body = { error: 'Section must be "memory", "user", or "soul"' }
    return
  }

  let filePath: string
  if (section === 'soul') {
    filePath = join(hermesDir(), 'SOUL.md')
  } else {
    const fileName = section === 'memory' ? 'MEMORY.md' : 'USER.md'
    filePath = join(hermesDir(), 'memories', fileName)
  }

  try {
    await writeFile(filePath, content, 'utf-8')
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// --- Config Model Routes ---

interface ModelInfo {
  id: string
  label: string
}

interface ModelGroup {
  provider: string
  models: ModelInfo[]
}

// Build model list from user's actual config.yaml using js-yaml
function buildModelGroups(config: Record<string, any>): { default: string; groups: ModelGroup[] } {
  let defaultModel = ''
  let defaultProvider = ''
  const groups: ModelGroup[] = []
  const allModelIds = new Set<string>()

  // 1. Extract current model
  const modelSection = config.model
  if (typeof modelSection === 'object' && modelSection !== null) {
    defaultModel = String(modelSection.default || '').trim()
    defaultProvider = String(modelSection.provider || '').trim()
  } else if (typeof modelSection === 'string') {
    defaultModel = modelSection.trim()
  }

  // 2. Extract custom_providers section
  const customProviders = config.custom_providers
  if (Array.isArray(customProviders)) {
    const customModels: ModelInfo[] = []
    for (const entry of customProviders) {
      if (entry && typeof entry === 'object') {
        const cName = String(entry.name || '').trim()
        const cModel = String(entry.model || '').trim()
        if (cName && cModel) {
          customModels.push({ id: cModel, label: `${cName}: ${cModel}` })
          allModelIds.add(cModel)
        }
      }
    }
    if (customModels.length > 0) {
      groups.push({ provider: 'Custom', models: customModels })
    }
  }

  // 3. Add current default model (if not already in custom_providers)
  if (defaultModel && !allModelIds.has(defaultModel)) {
    groups.unshift({ provider: 'Current', models: [{ id: defaultModel, label: defaultModel }] })
  }

  return { default: defaultModel, groups }
}

// GET /api/available-models — fetch models from all credential pool endpoints
fsRoutes.get('/api/hermes/available-models', async (ctx) => {
  try {
    const auth = await loadAuthJson()
    const pool = auth?.credential_pool || {}

    const config = await readConfigYaml()
    const modelSection = config.model
    let currentDefault = ''
    if (typeof modelSection === 'object' && modelSection !== null) {
      currentDefault = String(modelSection.default || '').trim()
    } else if (typeof modelSection === 'string') {
      currentDefault = modelSection.trim()
    }

    // Collect unique endpoints from credential pool
    const endpoints: Array<{ key: string; label: string; base_url: string; token: string }> = []
    const seenUrls = new Set<string>()

    for (const [providerKey, entries] of Object.entries(pool)) {
      if (!Array.isArray(entries) || entries.length === 0) continue
      const entry = entries.find(e => e.last_status !== 'exhausted') || entries[0]
      if (!entry?.base_url || !entry?.access_token) continue
      const baseUrl = entry.base_url.replace(/\/+$/, '')
      if (seenUrls.has(baseUrl)) continue
      seenUrls.add(baseUrl)
      endpoints.push({
        key: providerKey,
        label: providerKey.replace(/^custom:/, '') || entry.label || baseUrl,
        base_url: baseUrl,
        token: entry.access_token,
      })
    }

    // Resolve models: hardcoded catalog first, live probe as fallback
    const groups: Array<{ provider: string; label: string; base_url: string; models: string[] }> = []
    const liveEndpoints: typeof endpoints = []

    for (const ep of endpoints) {
      const catalogModels = PROVIDER_MODEL_CATALOG[ep.key]
      if (catalogModels && catalogModels.length > 0) {
        groups.push({ provider: ep.key, label: ep.label, base_url: ep.base_url, models: catalogModels })
      } else {
        liveEndpoints.push(ep)
      }
    }

    if (liveEndpoints.length > 0) {
      const results = await Promise.allSettled(
        liveEndpoints.map(async ep => {
          const models = await fetchProviderModels(ep.base_url, ep.token)
          return { ...ep, models }
        }),
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.models.length > 0) {
          const { key, label, base_url, models } = result.value
          groups.push({ provider: key, label, base_url, models: [...new Set(models)] })
        } else if (result.status === 'rejected') {
          console.error(`[available-models] Failed: ${result.reason?.message || result.reason}`)
        }
      }
    }

    // Deduplicate models within each group and merge groups with the same provider key
    const dedupedGroups: typeof groups = []
    const seenProviders = new Map<string, number>()
    for (const g of groups) {
      g.models = [...new Set(g.models)]
      const existingIdx = seenProviders.get(g.provider)
      if (existingIdx !== undefined) {
        // Merge models into existing group
        const existing = dedupedGroups[existingIdx]
        const existingSet = new Set(existing.models)
        for (const m of g.models) {
          if (!existingSet.has(m)) existing.models.push(m)
        }
      } else {
        seenProviders.set(g.provider, dedupedGroups.length)
        dedupedGroups.push(g)
      }
    }

    // Fallback: if no providers returned models, fall back to config.yaml parsing
    if (dedupedGroups.length === 0) {
      const fallback = buildModelGroups(config)
      ctx.body = fallback
      return
    }

    ctx.body = { default: currentDefault, groups: dedupedGroups }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/config/models
fsRoutes.get('/api/hermes/config/models', async (ctx) => {
  try {
    const config = await readConfigYaml()
    ctx.body = buildModelGroups(config)
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// PUT /api/config/model
fsRoutes.put('/api/hermes/config/model', async (ctx) => {
  const { default: defaultModel, provider: reqProvider } = ctx.request.body as {
    default: string
    provider?: string
  }

  if (!defaultModel) {
    ctx.status = 400
    ctx.body = { error: 'Missing default model' }
    return
  }

  try {
    const config = await readConfigYaml()

    if (typeof config.model !== 'object' || config.model === null) {
      config.model = {}
    }

    config.model.default = defaultModel
    if (reqProvider) {
      config.model.provider = reqProvider
    }

    await writeConfigYaml(config)
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// POST /api/config/providers
fsRoutes.post('/api/hermes/config/providers', async (ctx) => {
  const { name, base_url, api_key, model, providerKey } = ctx.request.body as {
    name: string
    base_url: string
    api_key: string
    model: string
    providerKey?: string | null
  }

  if (!name || !base_url || !model) {
    ctx.status = 400
    ctx.body = { error: 'Missing name, base_url, or model' }
    return
  }

  if (!api_key) {
    ctx.status = 400
    ctx.body = { error: 'Missing API key' }
    return
  }

  try {
    // Determine if this is a built-in provider or a custom one
    const poolKey = providerKey
      || `custom:${name.trim().toLowerCase().replace(/ /g, '-')}`
    const isBuiltin = poolKey in PROVIDER_ENV_MAP

    if (!isBuiltin) {
      // Custom provider: write to config.yaml custom_providers
      const config = await readConfigYaml()
      if (!Array.isArray(config.custom_providers)) {
        config.custom_providers = []
      }
      config.custom_providers.push({ name, base_url, api_key, model })
      await writeConfigYaml(config)
    }

    // Write to auth.json credential_pool (all providers)
    const auth = await loadAuthJson() || { credential_pool: {} }
    if (!auth.credential_pool) auth.credential_pool = {}
    if (!auth.credential_pool[poolKey]) {
      auth.credential_pool[poolKey] = []
    }
    auth.credential_pool[poolKey].push({
      id: `${poolKey}-${Date.now()}`,
      label: name,
      base_url,
      access_token: api_key,
      last_status: null,
    })
    await saveAuthJson(auth)

    // Write API key to .env (built-in providers only)
    const envMapping = PROVIDER_ENV_MAP[poolKey] || PROVIDER_ENV_MAP[providerKey || '']
    if (envMapping) {
      await saveEnvValue(envMapping.api_key_env, api_key)
      if (envMapping.base_url_env) {
        await saveEnvValue(envMapping.base_url_env, base_url)
      }
    }

    // Auto-switch model to the newly added provider
    const config2 = await readConfigYaml()
    if (typeof config2.model !== 'object' || config2.model === null) {
      config2.model = {}
    }
    config2.model.default = model
    config2.model.provider = poolKey
    await writeConfigYaml(config2)

    // Restart gateway to pick up .env and config.yaml changes
    try {
      await hermesCli.restartGateway()
    } catch (e: any) {
      console.error('[Provider] Gateway restart failed:', e.message)
    }

    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// DELETE /api/config/providers/:poolKey
fsRoutes.delete('/api/hermes/config/providers/:poolKey', async (ctx) => {
  const poolKey = decodeURIComponent(ctx.params.poolKey)

  try {
    const auth = await loadAuthJson()
    if (!auth?.credential_pool) {
      ctx.status = 404
      ctx.body = { error: 'No credential pool found' }
      return
    }

    const keys = Object.keys(auth.credential_pool)

    if (keys.length <= 1) {
      ctx.status = 400
      ctx.body = { error: 'Cannot delete the last provider' }
      return
    }

    if (!(poolKey in auth.credential_pool)) {
      ctx.status = 404
      ctx.body = { error: `Provider "${poolKey}" not found` }
      return
    }

    // Check if this is the current active provider
    const config = await readConfigYaml()
    const currentProvider = config.model?.provider
    const isCurrent = currentProvider === poolKey

    // Save base_url before deleting
    const deletedBaseUrl = auth.credential_pool[poolKey]?.[0]?.base_url

    // 1. Delete from auth.json
    delete auth.credential_pool[poolKey]
    await saveAuthJson(auth)

    // 2. Remove matching entry from config.yaml custom_providers
    if (deletedBaseUrl && Array.isArray(config.custom_providers)) {
      config.custom_providers = (config.custom_providers as any[]).filter(
        (entry: any) => entry.base_url !== deletedBaseUrl,
      )
      await writeConfigYaml(config)
    }

    // 3. If was the current provider, switch to first remaining
    if (isCurrent) {
      const remainingKeys = Object.keys(auth.credential_pool)
      if (remainingKeys.length > 0) {
        const fallback = remainingKeys[0]
        const fallbackEntry = auth.credential_pool[fallback]?.[0]
        const catalogModels = PROVIDER_MODEL_CATALOG[fallback] || []
        const fallbackModel = catalogModels[0] || fallbackEntry?.label || fallback

        const config2 = await readConfigYaml()
        if (typeof config2.model !== 'object' || config2.model === null) {
          config2.model = {}
        }
        config2.model.default = fallbackModel
        config2.model.provider = fallback
        await writeConfigYaml(config2)
      }
    }

    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})
