import Router from '@koa/router'
import { readFile, writeFile, copyFile } from 'fs/promises'
import { chmod } from 'fs/promises'
import { resolve } from 'path'
import { homedir } from 'os'
import YAML from 'js-yaml'
import { restartGateway } from '../../services/hermes-cli'

// Platform sections that require gateway restart after config change
const PLATFORM_SECTIONS = new Set([
  'telegram', 'discord', 'slack', 'whatsapp', 'matrix',
  'weixin', 'wecom', 'feishu', 'dingtalk',
])

const configPath = resolve(homedir(), '.hermes/config.yaml')
const envPath = resolve(homedir(), '.hermes/.env')

// Env var → (platform, configPath in PlatformConfig) mapping
// Matches hermes _apply_env_overrides() in gateway/config.py
const envPlatformMap: Record<string, [string, string]> = {
  TELEGRAM_BOT_TOKEN: ['telegram', 'token'],
  DISCORD_BOT_TOKEN: ['discord', 'token'],
  SLACK_BOT_TOKEN: ['slack', 'token'],
  MATRIX_ACCESS_TOKEN: ['matrix', 'token'],
  MATRIX_HOMESERVER: ['matrix', 'extra.homeserver'],
  FEISHU_APP_ID: ['feishu', 'extra.app_id'],
  FEISHU_APP_SECRET: ['feishu', 'extra.app_secret'],
  DINGTALK_CLIENT_ID: ['dingtalk', 'extra.client_id'],
  DINGTALK_CLIENT_SECRET: ['dingtalk', 'extra.client_secret'],
  // DingTalk has no _apply_env_overrides entry in hermes;
  // the adapter reads these env vars directly at runtime.
  DINGTALK_APP_KEY: ['dingtalk', 'extra.app_key'],
  WECOM_BOT_ID: ['wecom', 'extra.bot_id'],
  WECOM_SECRET: ['wecom', 'extra.secret'],
  WEIXIN_TOKEN: ['weixin', 'token'],
  WEIXIN_ACCOUNT_ID: ['weixin', 'extra.account_id'],
  WEIXIN_BASE_URL: ['weixin', 'extra.base_url'],
  WHATSAPP_ENABLED: ['whatsapp', 'enabled'],
}

// Reverse map: (platform, configPath) → env var
const platformEnvMap: Record<string, Record<string, string>> = {}
for (const [envVar, [platform, configPath]] of Object.entries(envPlatformMap)) {
  if (!platformEnvMap[platform]) platformEnvMap[platform] = {}
  platformEnvMap[platform][configPath] = envVar
}

function parseEnv(raw: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (val) env[key] = val
  }
  return env
}

function setNested(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function getNested(obj: Record<string, any>, path: string): any {
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

async function readEnvPlatforms(): Promise<Record<string, any>> {
  try {
    const raw = await readFile(envPath, 'utf-8')
    const env = parseEnv(raw)
    const platforms: Record<string, any> = {}
    for (const [envKey, [platform, cfgPath]] of Object.entries(envPlatformMap)) {
      const val = env[envKey]
      if (val === undefined || val === '') continue
      if (!platforms[platform]) platforms[platform] = {}
      let finalVal: any = val
      if (cfgPath === 'enabled') finalVal = val === 'true'
      setNested(platforms[platform], cfgPath, finalVal)
    }
    return platforms
  } catch {
    return {}
  }
}

// Write a KEY=value to .env (matching hermes save_env_value behavior)
// If value is empty, remove the line instead
async function saveEnvValue(key: string, value: string): Promise<void> {
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
    if (trimmed.startsWith('#')) {
      // Check if there's a commented-out version of this key
      if (trimmed.startsWith(`# ${key}=`)) {
        if (!remove) {
          result.push(`${key}=${value}`)
        }
        found = true
      } else {
        result.push(line)
      }
    } else {
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1 && trimmed.slice(0, eqIdx).trim() === key) {
        if (!remove) {
          result.push(`${key}=${value}`)
        }
        found = true
      } else {
        result.push(line)
      }
    }
  }

  if (!found && !remove) {
    result.push(`${key}=${value}`)
  }

  // Remove trailing empty lines, keep exactly one trailing newline
  let output = result.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '') + '\n'
  await writeFile(envPath, output, 'utf-8')
  // Set permissions to 0600 (owner only), matching hermes behavior
  try { await chmod(envPath, 0o600) } catch { /* ignore */ }
}

async function readConfig(): Promise<Record<string, any>> {
  const raw = await readFile(configPath, 'utf-8')
  return (YAML.load(raw) as Record<string, any>) || {}
}

async function writeConfig(data: Record<string, any>): Promise<void> {
  await copyFile(configPath, configPath + '.bak')
  const yamlStr = YAML.dump(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  })
  await writeFile(configPath, yamlStr, 'utf-8')
}

export const configRoutes = new Router()

// GET /api/config — read config sections
configRoutes.get('/api/hermes/config', async (ctx) => {
  try {
    const config = await readConfig()
    // Merge .env platform credentials into platforms section
    const envPlatforms = await readEnvPlatforms()
    if (Object.keys(envPlatforms).length > 0) {
      // Deep-merge: env values fill in missing, don't overwrite config.yaml
      const existing = config.platforms || {}
      for (const [platform, vals] of Object.entries(envPlatforms)) {
        existing[platform] = { ...(existing[platform] || {}), ...(vals as Record<string, any>) }
      }
      config.platforms = existing
    }
    const { section, sections } = ctx.query

    if (section) {
      ctx.body = { [section as string]: config[section as string] || {} }
    } else if (sections) {
      const keys = (sections as string).split(',')
      const result: Record<string, any> = {}
      for (const key of keys) {
        result[key.trim()] = config[key.trim()] || {}
      }
      ctx.body = result
    } else {
      ctx.body = config
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// PUT /api/config — update a config section (writes to config.yaml)
configRoutes.put('/api/hermes/config', async (ctx) => {
  const { section, values } = ctx.request.body as {
    section: string
    values: Record<string, any>
  }

  if (!section || !values) {
    ctx.status = 400
    ctx.body = { error: 'Missing section or values' }
    return
  }

  try {
    const config = await readConfig()
    config[section] = { ...(config[section] || {}), ...values }
    await writeConfig(config)
    // Restart gateway for platform/channel config changes
    if (PLATFORM_SECTIONS.has(section)) {
      await restartGateway()
    }
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// PUT /api/config/credentials — save platform credentials to .env
// Body: { platform: string, values: Record<string, any> }
// values keys match PlatformConfig paths: 'token', 'extra.app_id', 'extra.app_secret', etc.
configRoutes.put('/api/hermes/config/credentials', async (ctx) => {
  const { platform, values } = ctx.request.body as {
    platform: string
    values: Record<string, any>
  }

  if (!platform || !values) {
    ctx.status = 400
    ctx.body = { error: 'Missing platform or values' }
    return
  }

  try {
    const envMap = platformEnvMap[platform]
    if (!envMap) {
      ctx.status = 400
      ctx.body = { error: `Unknown platform: ${platform}` }
      return
    }

    // Also clean up config.yaml platforms.<platform> to keep in sync
    const config = await readConfig()
    let configChanged = false

    // Flatten nested values: { extra: { app_id: '' } } → { 'extra.app_id': '' }
    const flatValues: Record<string, any> = {}
    for (const [key, val] of Object.entries(values)) {
      if (key === 'extra' && val && typeof val === 'object') {
        for (const [subKey, subVal] of Object.entries(val as Record<string, any>)) {
          flatValues[`extra.${subKey}`] = subVal
        }
      } else {
        flatValues[key] = val
      }
    }

    for (const [cfgPath, val] of Object.entries(flatValues)) {
      const envVar = envMap[cfgPath]
      if (!envVar) continue
      if (val === undefined || val === null || val === '') {
        await saveEnvValue(envVar, '')
        // Remove from config.yaml too
        const parts = cfgPath.split('.')
        let obj: any = config.platforms?.[platform]
        if (obj) {
          if (parts.length === 1) {
            delete obj[parts[0]]
          } else {
            let cur = obj
            for (let i = 0; i < parts.length - 1; i++) {
              if (!cur[parts[i]]) break
              cur = cur[parts[i]]
            }
            delete cur[parts[parts.length - 1]]
            // Clean up empty extra
            if (obj.extra && Object.keys(obj.extra).length === 0) delete obj.extra
          }
          if (Object.keys(obj).length === 0) {
            if (!config.platforms) config.platforms = {}
            delete config.platforms[platform]
          }
          configChanged = true
        }
      } else {
        await saveEnvValue(envVar, String(val))
      }
    }

    if (configChanged) {
      await writeConfig(config)
    }

    // Restart gateway for platform credential changes
    await restartGateway()

    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})
