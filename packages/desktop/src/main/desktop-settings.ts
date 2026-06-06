import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type DesktopLaunchMode = 'local' | 'remote'
export type DesktopThemeStyle = 'ink' | 'comic' | 'person5'

type DesktopSettings = {
  launchMode?: DesktopLaunchMode
  remoteServerUrl?: string | null
  themeStyle?: DesktopThemeStyle | null
}

const SETTINGS_FILE = 'hermes-desktop-settings.json'

function settingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

function parseSettings(raw: string): DesktopSettings {
  const data = JSON.parse(raw) as DesktopSettings
  return data && typeof data === 'object' ? data : {}
}

export function readDesktopSettings(): DesktopSettings {
  const file = settingsPath()
  if (!existsSync(file)) return {}
  try {
    return parseSettings(readFileSync(file, 'utf8'))
  } catch (err) {
    console.warn(`[desktop-settings] failed to read settings: ${err instanceof Error ? err.message : String(err)}`)
    return {}
  }
}

export function saveDesktopSettings(updates: DesktopSettings): void {
  const current = readDesktopSettings()
  const next = { ...current, ...updates }
  const file = settingsPath()
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  } catch (err) {
    console.warn(`[desktop-settings] failed to save settings: ${err instanceof Error ? err.message : String(err)}`)
  }
}
