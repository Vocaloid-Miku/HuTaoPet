import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  DEFAULT_APPEARANCE,
  cloneAppearanceConfig,
  normalizeAppearanceConfig,
  sanitizeSpeechTextsForSave,
  type AppearanceConfig
} from '../shared/appearance'
import { getCustomAppearanceConfigPath, updateAppearanceConfigPath } from './systemConfig'

const USER_CONFIG_FILE = 'appearance.json'

let currentAppearance: AppearanceConfig = cloneAppearanceConfig(DEFAULT_APPEARANCE)
let savedAppearance: AppearanceConfig = cloneAppearanceConfig(DEFAULT_APPEARANCE)
/** Bumped on hard writes (save / theme replace). Stale previews must be ignored. */
let appearanceGeneration = 0

function getDefaultUserConfigPath(): string {
  return join(app.getPath('userData'), USER_CONFIG_FILE)
}

function getActiveConfigPath(): string {
  return getCustomAppearanceConfigPath() ?? getDefaultUserConfigPath()
}

function getBundledDefaultPath(): string {
  if (is.dev) {
    return join(process.cwd(), 'config', 'appearance.json')
  }
  return join(process.resourcesPath, 'config', 'appearance.json')
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/** Appearance defaults only come from the bundled appearance config file. */
export function loadDefaultAppearance(): AppearanceConfig {
  try {
    const path = getBundledDefaultPath()
    if (existsSync(path)) {
      return normalizeAppearanceConfig(readJsonFile(path))
    }
  } catch (error) {
    console.warn('Failed to load default appearance config:', error)
  }
  return cloneAppearanceConfig(DEFAULT_APPEARANCE)
}

function loadSavedAppearance(): AppearanceConfig | null {
  const path = getActiveConfigPath()
  if (!existsSync(path)) return null

  try {
    return normalizeAppearanceConfig(readJsonFile(path))
  } catch (error) {
    console.warn('Failed to load saved appearance config:', error)
    return null
  }
}

function saveAppearanceToFile(config: AppearanceConfig): void {
  const path = getActiveConfigPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
}

function broadcastAppearanceConfig(
  win: BrowserWindow | null,
  config: AppearanceConfig,
  generation = appearanceGeneration
): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send('appearance-config-changed', config, generation)
}

function broadcastAppearanceConfigToAll(
  config: AppearanceConfig,
  generation = appearanceGeneration
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('appearance-config-changed', config, generation)
    }
  }
}

function reloadAppearanceState(): AppearanceConfig {
  const defaults = loadDefaultAppearance()
  const saved = loadSavedAppearance()
  currentAppearance = saved ?? defaults
  savedAppearance = cloneAppearanceConfig(currentAppearance)
  return currentAppearance
}

export function initializeAppearanceConfig(): AppearanceConfig {
  return reloadAppearanceState()
}

export function getAppearanceGeneration(): number {
  return appearanceGeneration
}

export function getCurrentAppearance(): AppearanceConfig {
  return cloneAppearanceConfig(currentAppearance)
}

export function getSavedAppearance(): AppearanceConfig {
  return cloneAppearanceConfig(savedAppearance)
}

export function getAppearanceConfigPath(): string {
  return getActiveConfigPath()
}

export function setAppearanceConfigPath(
  _win: BrowserWindow | null,
  path: string,
  setPetWindowSize: (size: number) => number
): string {
  updateAppearanceConfigPath(path)
  appearanceGeneration += 1
  const next = reloadAppearanceState()
  setPetWindowSize(next.petSize)
  broadcastAppearanceConfigToAll(next, appearanceGeneration)
  return getActiveConfigPath()
}

export function applyAppearanceToPetWindow(
  win: BrowserWindow | null,
  config: AppearanceConfig,
  setPetWindowSize: (size: number) => number
): AppearanceConfig {
  const next = normalizeAppearanceConfig(config)
  currentAppearance = next
  setPetWindowSize(next.petSize)
  broadcastAppearanceConfig(win, next)
  return next
}

export function previewAppearanceConfig(
  win: BrowserWindow | null,
  partial: Partial<AppearanceConfig>,
  setPetWindowSize: (size: number) => number,
  clientGeneration?: number
): AppearanceConfig {
  if (
    typeof clientGeneration === 'number' &&
    clientGeneration !== appearanceGeneration
  ) {
    return cloneAppearanceConfig(currentAppearance)
  }
  return applyAppearanceToPetWindow(
    win,
    {
      ...currentAppearance,
      ...partial,
      speechTexts: partial.speechTexts
        ? [...partial.speechTexts]
        : [...currentAppearance.speechTexts]
    },
    setPetWindowSize
  )
}

export function saveAppearanceConfig(
  win: BrowserWindow | null,
  config: AppearanceConfig | undefined,
  setPetWindowSize: (size: number) => number
): AppearanceConfig {
  appearanceGeneration += 1
  const source = config ?? currentAppearance
  const next = applyAppearanceToPetWindow(
    win,
    {
      ...source,
      speechTexts: sanitizeSpeechTextsForSave(source.speechTexts)
    },
    setPetWindowSize
  )
  savedAppearance = cloneAppearanceConfig(next)
  saveAppearanceToFile(next)
  broadcastAppearanceConfigToAll(next, appearanceGeneration)
  return next
}

/** Replace the appearance config file with theme built-in values and apply. */
export function replaceAppearanceConfig(
  win: BrowserWindow | null,
  config: AppearanceConfig,
  setPetWindowSize: (size: number) => number
): AppearanceConfig {
  return saveAppearanceConfig(win, config, setPetWindowSize)
}

export function resetAppearanceConfig(
  win: BrowserWindow | null,
  setPetWindowSize: (size: number) => number
): AppearanceConfig {
  return applyAppearanceToPetWindow(win, savedAppearance, setPetWindowSize)
}

export function restoreDefaultAppearanceConfig(
  win: BrowserWindow | null,
  setPetWindowSize: (size: number) => number
): AppearanceConfig {
  return applyAppearanceToPetWindow(win, loadDefaultAppearance(), setPetWindowSize)
}
