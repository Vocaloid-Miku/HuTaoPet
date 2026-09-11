import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import {
  DEFAULT_SYSTEM,
  normalizeSystemConfig,
  type SystemConfig
} from '../shared/system'

const USER_CONFIG_FILE = 'system.json'

let currentSystemConfig: SystemConfig = { ...DEFAULT_SYSTEM }
let savedSystemConfig: SystemConfig = { ...DEFAULT_SYSTEM }

function getUserConfigPath(): string {
  return join(app.getPath('userData'), USER_CONFIG_FILE)
}

function getBundledDefaultPath(): string {
  if (is.dev) {
    return join(process.cwd(), 'config', 'system.json')
  }
  return join(process.resourcesPath, 'config', 'system.json')
}

function getDefaultSoundFolderPath(): string {
  if (is.dev) {
    return join(process.cwd(), 'audio')
  }
  return join(dirname(app.getPath('exe')), 'audio')
}

function getDefaultThemeFolderPath(): string {
  if (is.dev) {
    return join(process.cwd(), 'theme')
  }
  return join(dirname(app.getPath('exe')), 'theme')
}

function getDefaultSoundConfigPath(): string {
  return join(getSoundFolderPath(), 'settings.json')
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function broadcastSystemConfig(config: SystemConfig): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('system-config-changed', config)
    }
  }
}

export function loadDefaultSystemConfig(): SystemConfig {
  try {
    const path = getBundledDefaultPath()
    if (existsSync(path)) {
      return normalizeSystemConfig(readJsonFile(path))
    }
  } catch (error) {
    console.warn('Failed to load default system config:', error)
  }
  return { ...DEFAULT_SYSTEM }
}

function loadUserSystemConfig(): SystemConfig | null {
  const path = getUserConfigPath()
  if (!existsSync(path)) return null

  try {
    return normalizeSystemConfig(readJsonFile(path))
  } catch (error) {
    console.warn('Failed to load user system config:', error)
    return null
  }
}

function saveSystemConfigToFile(config: SystemConfig): void {
  const path = getUserConfigPath()
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
}

function applyAutoLaunch(enabled: boolean): void {
  try {
    const ok = electronApp.setAutoLaunch(enabled)
    if (!ok) {
      console.warn('Failed to apply auto-start setting (unsupported platform or OS rejected it)')
    }
  } catch (error) {
    console.warn('Failed to apply auto-start setting:', error)
  }
}

export function initializeSystemConfig(): SystemConfig {
  const defaults = loadDefaultSystemConfig()
  const saved = loadUserSystemConfig()
  currentSystemConfig = saved ?? defaults
  savedSystemConfig = { ...currentSystemConfig }
  applyAutoLaunch(currentSystemConfig.autoStart)
  return currentSystemConfig
}

export function getSystemConfig(): SystemConfig {
  return { ...currentSystemConfig }
}

export function getSavedSystemConfig(): SystemConfig {
  return { ...savedSystemConfig }
}

export function getSystemConfigPath(): string {
  return getUserConfigPath()
}

export function getSoundFolderPath(): string {
  const custom = currentSystemConfig.soundFolderPath.trim()
  return custom || getDefaultSoundFolderPath()
}

export function getThemeFolderPath(): string {
  const custom = currentSystemConfig.themeFolderPath.trim()
  return custom || getDefaultThemeFolderPath()
}

export function getCustomAppearanceConfigPath(): string | undefined {
  const path = currentSystemConfig.appearanceConfigPath.trim()
  return path || undefined
}

export function getCustomSoundConfigPath(): string | undefined {
  const path = currentSystemConfig.soundConfigPath.trim()
  return path || undefined
}

export function getSoundConfigPath(): string {
  return getCustomSoundConfigPath() ?? getDefaultSoundConfigPath()
}

export function saveSystemConfig(config: SystemConfig): SystemConfig {
  const next = normalizeSystemConfig(config)
  currentSystemConfig = next
  savedSystemConfig = { ...next }
  saveSystemConfigToFile(next)
  applyAutoLaunch(next.autoStart)
  broadcastSystemConfig(next)
  return next
}

export function setAutoStart(enabled: boolean): SystemConfig {
  return saveSystemConfig({
    ...currentSystemConfig,
    autoStart: Boolean(enabled)
  })
}

export function resetSystemConfig(): SystemConfig {
  currentSystemConfig = { ...savedSystemConfig }
  return { ...currentSystemConfig }
}

export function restoreDefaultSystemConfig(): SystemConfig {
  const defaults = loadDefaultSystemConfig()
  currentSystemConfig = { ...defaults }
  return { ...currentSystemConfig }
}

export function updateAppearanceConfigPath(path: string): SystemConfig {
  return saveSystemConfig({
    ...currentSystemConfig,
    appearanceConfigPath: path.trim()
  })
}

export function updateSoundFolderPath(path: string): SystemConfig {
  const trimmed = path.trim()
  const normalized = trimmed === getDefaultSoundFolderPath() ? '' : trimmed
  return saveSystemConfig({
    ...currentSystemConfig,
    soundFolderPath: normalized
  })
}

export function updateSoundConfigPath(path: string): SystemConfig {
  const trimmed = path.trim()
  const normalized = trimmed === getDefaultSoundConfigPath() ? '' : trimmed
  return saveSystemConfig({
    ...currentSystemConfig,
    soundConfigPath: normalized
  })
}

export function updateThemeFolderPath(path: string): SystemConfig {
  const trimmed = path.trim()
  const normalized = trimmed === getDefaultThemeFolderPath() ? '' : trimmed
  return saveSystemConfig({
    ...currentSystemConfig,
    themeFolderPath: normalized
  })
}
