import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { stripLegacyApiServerGatewayConfig } from '../config-helpers'
import { logger } from '../logger'
import { safeFileStore } from '../safe-file-store'
import { getProfileDir, listProfileNamesFromDisk } from './hermes-profile'
import { startGatewayRunManaged } from './gateway-runner'

const execFileAsync = promisify(execFile)

const RESERVED_PROFILE_NAMES = new Set([
  'hermes', 'test', 'tmp', 'root', 'sudo',
])

const HERMES_SUBCOMMAND_PROFILE_NAMES = new Set([
  'chat', 'model', 'gateway', 'setup', 'whatsapp', 'login', 'logout',
  'status', 'cron', 'doctor', 'dump', 'config', 'pairing', 'skills', 'tools',
  'mcp', 'sessions', 'insights', 'version', 'update', 'uninstall',
  'profile', 'plugins', 'honcho', 'acp',
])

function resolveHermesBin(): string {
  return process.env.HERMES_BIN?.trim() || 'hermes'
}

function isReservedProfileName(profile: string): boolean {
  const normalized = String(profile || '').trim().toLowerCase()
  if (!normalized || normalized === 'default') return false
  return RESERVED_PROFILE_NAMES.has(normalized) || HERMES_SUBCOMMAND_PROFILE_NAMES.has(normalized)
}

function isDockerRuntime(): boolean {
  return existsSync('/.dockerenv')
}

function isTermuxRuntime(): boolean {
  const prefix = process.env.PREFIX || ''
  return !!process.env.TERMUX_VERSION ||
    prefix.includes('/com.termux/') ||
    existsSync('/data/data/com.termux/files/usr')
}

function requiresManagedGatewayRun(): boolean {
  return isDockerRuntime() || isTermuxRuntime() || process.platform === 'win32'
}

export function gatewayStatusLooksRunning(output: string): boolean {
  const text = output.toLowerCase()
  if (text.includes('gateway is not running') || text.includes('not running')) return false
  return text.includes('gateway is running') || text.includes('running')
}

export function gatewayStatusLooksRuntimeLocked(output: string): boolean {
  const text = output.toLowerCase()
  return text.includes('runtime lock is already held')
    || text.includes('gateway runtime lock is already held')
    || text.includes('already held by another instance')
}

export function parseGatewayStatusesFromProfileListOutput(stdout: string): Map<string, string> {
  const statuses = new Map<string, string>()
  const normalized = stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.trim().split('\n').filter(Boolean)
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('Profile') || trimmed.match(/^─/)) continue

    const body = trimmed.startsWith('◆') ? trimmed.slice(1).trim() : trimmed
    const columns = body.split(/\s{2,}/).map(part => part.trim())
    if (columns.length >= 3 && columns[0]) {
      statuses.set(columns[0], columns[2])
    }
  }
  return statuses
}

async function listGatewayStatusesFromProfileList(hermesBin: string): Promise<Map<string, string>> {
  const { stdout } = await execFileAsync(hermesBin, ['profile', 'list'], {
    timeout: 10000,
    windowsHide: true,
  })
  return parseGatewayStatusesFromProfileListOutput(stdout)
}

async function isGatewayRunningInProfileList(hermesBin: string, profile: string): Promise<boolean> {
  const statuses = await listGatewayStatusesFromProfileList(hermesBin)
  const status = statuses.get(profile)
  return status !== undefined && gatewayStatusLooksRunning(status)
}

export async function isGatewayRunningForProfile(hermesBin: string, profileDir: string): Promise<boolean> {
  try {
    const { stdout, stderr } = await execFileAsync(hermesBin, ['gateway', 'status'], {
      timeout: 10000,
      windowsHide: true,
      env: {
        ...process.env,
        HERMES_HOME: profileDir,
      },
    })
    return gatewayStatusLooksRunning(`${stdout}\n${stderr}`)
  } catch (err: any) {
    const output = `${err?.stdout || ''}\n${err?.stderr || ''}\n${err?.message || ''}`
    if (gatewayStatusLooksRuntimeLocked(output)) {
      logger.info({ profileDir }, 'Hermes gateway status reported runtime lock held; treating gateway as already running')
      return true
    }
    if (output.trim()) {
      logger.warn({ err, profileDir }, 'Hermes gateway status failed; treating as not running')
    }
    return false
  }
}

async function waitForGatewayRunning(hermesBin: string, profile: string, profileDir: string, timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await isGatewayRunningInProfileList(hermesBin, profile)) return true
    } catch (err) {
      logger.warn(err, '[gateway-autostart] Hermes profile list check failed while waiting for gateway profile=%s', profile)
    }
    if (await isGatewayRunningForProfile(hermesBin, profileDir)) return true
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

async function stopGatewayForProfile(hermesBin: string, profile: string, profileDir: string): Promise<void> {
  try {
    await execFileAsync(hermesBin, ['gateway', 'stop'], {
      timeout: 30000,
      windowsHide: true,
      env: {
        ...process.env,
        HERMES_HOME: profileDir,
      },
    })
    logger.info('[gateway-autostart] gateway stopped profile=%s home=%s', profile, profileDir)
  } catch (err) {
    logger.warn(err, '[gateway-autostart] Hermes CLI gateway stop failed before restart profile=%s home=%s', profile, profileDir)
  }
}

export async function startGatewayForProfile(hermesBin: string, profile: string, profileDir: string): Promise<void> {
  if (requiresManagedGatewayRun()) {
    const result = startGatewayRunManaged(hermesBin, { profileDir })
    logger.info(
      '[gateway-autostart] gateway started via background run profile=%s home=%s pid=%s',
      profile,
      profileDir,
      result.pid || 'unknown',
    )
    return
  }

  try {
    await execFileAsync(hermesBin, ['gateway', 'start'], {
      timeout: 30000,
      windowsHide: true,
      env: {
        ...process.env,
        HERMES_HOME: profileDir,
      },
    })
    logger.info('[gateway-autostart] gateway started via Hermes CLI service profile=%s home=%s', profile, profileDir)
  } catch (err) {
    logger.warn(err, '[gateway-autostart] Hermes CLI gateway start failed; falling back to background run profile=%s home=%s', profile, profileDir)
    const result = startGatewayRunManaged(hermesBin, { profileDir })
    logger.info(
      '[gateway-autostart] gateway started via fallback background run profile=%s home=%s pid=%s',
      profile,
      profileDir,
      result.pid || 'unknown',
    )
  }
}

export async function getGatewayRuntimeStatusForProfile(profile: string): Promise<{ running: boolean; profile: string }> {
  const hermesBin = resolveHermesBin()
  const profileDir = getProfileDir(profile)
  const running = await isGatewayRunningForProfile(hermesBin, profileDir)
  return { running, profile }
}

export async function restartGatewayForProfile(profile: string): Promise<{ running: boolean; profile: string }> {
  const hermesBin = resolveHermesBin()
  const profileDir = getProfileDir(profile)
  await clearApiServerForProfile(profileDir)
  await stopGatewayForProfile(hermesBin, profile, profileDir)

  try {
    await startGatewayForProfile(hermesBin, profile, profileDir)
  } catch (err) {
    logger.error(err, '[gateway-autostart] Hermes gateway restart failed profile=%s home=%s', profile, profileDir)
    throw err
  }

  const running = await waitForGatewayRunning(hermesBin, profile, profileDir)
  if (!running) throw new Error('Hermes gateway start completed but gateway did not report running within timeout')
  return { running, profile }
}

export async function clearApiServerForProfile(profileDir: string): Promise<void> {
  const configPath = join(profileDir, 'config.yaml')
  try {
    await safeFileStore.updateYaml(configPath, (config) => {
      const result = stripLegacyApiServerGatewayConfig(config)
      return { data: result.config, result: undefined, write: result.changed }
    }, { backup: true })
  } catch (err) {
    logger.warn(err, 'Failed to clear legacy api_server gateway config before gateway startup: %s', profileDir)
  }
}

export async function ensureProfileGatewaysRunning(): Promise<void> {
  const hermesBin = resolveHermesBin()
  const profiles = listProfileNamesFromDisk()
  let gatewayStatuses: Map<string, string> | undefined
  try {
    gatewayStatuses = await listGatewayStatusesFromProfileList(hermesBin)
  } catch (err) {
    logger.warn(err, '[gateway-autostart] Hermes profile list failed; falling back to per-profile gateway status checks')
  }

  for (const profile of profiles) {
    if (isReservedProfileName(profile)) {
      logger.warn('[gateway-autostart] skipping reserved profile name during gateway autostart profile=%s', profile)
      continue
    }

    const profileDir = getProfileDir(profile)
    const status = gatewayStatuses?.get(profile)
    const running = status !== undefined
      ? gatewayStatusLooksRunning(status)
      : await isGatewayRunningForProfile(hermesBin, profileDir)
    if (running) {
      logger.info('[gateway-autostart] gateway already running profile=%s home=%s status=%s', profile, profileDir, status || 'status-check')
      continue
    }

    await clearApiServerForProfile(profileDir)
    await startGatewayForProfile(hermesBin, profile, profileDir)
    const ready = await waitForGatewayRunning(hermesBin, profile, profileDir)
    if (!ready) {
      logger.warn('[gateway-autostart] gateway start completed but did not report running within timeout profile=%s home=%s', profile, profileDir)
    }
  }
}
