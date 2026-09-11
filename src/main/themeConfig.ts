import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  normalizeAppearanceConfig,
  type AppearanceConfig
} from '../shared/appearance'
import {
  normalizeCharacterMeta,
  type CharacterMeta,
  type CharacterPackUrls
} from '../shared/character'
import type { ThemeConfig, ThemeEntry, ThemeOption } from '../shared/theme'
import { getThemeFolderPath } from './systemConfig'

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function normalizeThemeConfig(input: unknown): ThemeConfig | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Record<string, unknown>
  const activeTheme =
    typeof source.activeTheme === 'string' ? source.activeTheme.trim() : ''
  const themesRaw =
    source.themes && typeof source.themes === 'object'
      ? (source.themes as Record<string, unknown>)
      : null
  if (!activeTheme || !themesRaw) return null

  const themes: Record<string, ThemeEntry> = {}
  for (const [key, value] of Object.entries(themesRaw)) {
    if (!value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    const label = typeof entry.label === 'string' ? entry.label.trim() : key
    const folder = typeof entry.folder === 'string' ? entry.folder.trim() : ''
    if (!folder) continue
    themes[key] = { label, folder }
  }

  if (!themes[activeTheme]) return null
  return { activeTheme, themes }
}

function getThemeConfigPath(folder = getThemeFolderPath()): string {
  return join(folder, 'theme.json')
}

export function readThemeConfig(folder = getThemeFolderPath()): ThemeConfig | null {
  const path = getThemeConfigPath(folder)
  if (!existsSync(path)) return null

  try {
    return normalizeThemeConfig(readJsonFile(path))
  } catch (error) {
    console.warn('Failed to load theme config:', error)
    return null
  }
}

function writeThemeConfig(config: ThemeConfig, folder = getThemeFolderPath()): void {
  const path = getThemeConfigPath(folder)
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
}

export function listThemeOptions(folder = getThemeFolderPath()): ThemeOption[] {
  const config = readThemeConfig(folder)
  if (!config) return []
  return Object.entries(config.themes).map(([id, entry]) => ({
    id,
    label: entry.label
  }))
}

export function getActiveThemeId(folder = getThemeFolderPath()): string | null {
  return readThemeConfig(folder)?.activeTheme ?? null
}

export function getThemeFolderById(
  themeId: string,
  folder = getThemeFolderPath()
): string | null {
  const config = readThemeConfig(folder)
  if (!config) return null
  const entry = config.themes[themeId]
  if (!entry) return null
  return join(folder, entry.folder)
}

export function getActiveThemeFolder(folder = getThemeFolderPath()): string | null {
  const config = readThemeConfig(folder)
  if (!config) return null
  return getThemeFolderById(config.activeTheme, folder)
}

export function getThemeAppearancePath(
  themeId: string,
  folder = getThemeFolderPath()
): string | null {
  const themeFolder = getThemeFolderById(themeId, folder)
  if (!themeFolder) return null
  const path = join(themeFolder, 'appearance.json')
  return existsSync(path) ? path : null
}

export function readThemeAppearance(themeId: string): unknown | null {
  const path = getThemeAppearancePath(themeId)
  if (!path) return null

  try {
    return readJsonFile(path)
  } catch (error) {
    console.warn('Failed to load theme appearance config:', error)
    return null
  }
}

export function getThemeDefaultAppearancePath(folder = getThemeFolderPath()): string {
  return join(folder, 'default-appearance.json')
}

/** Default appearance used when creating a new theme. */
export function readThemeDefaultAppearance(folder = getThemeFolderPath()): AppearanceConfig {
  const path = getThemeDefaultAppearancePath(folder)
  if (!existsSync(path)) {
    console.warn('Theme default appearance missing, using built-in defaults:', path)
    return normalizeAppearanceConfig({})
  }

  try {
    return normalizeAppearanceConfig(readJsonFile(path))
  } catch (error) {
    console.warn('Failed to load theme default appearance:', error)
    return normalizeAppearanceConfig({})
  }
}

/** Write appearance.json for a theme. Creates the file if missing. */
export function writeThemeAppearance(themeId: string, config: AppearanceConfig): void {
  const id = themeId.trim()
  const themeFolder = getThemeFolderById(id)
  if (!themeFolder || !existsSync(themeFolder)) {
    throw new Error(`Theme folder not found: ${id}`)
  }

  const appearance = normalizeAppearanceConfig(config)
  const appearancePath = join(themeFolder, 'appearance.json')
  writeFileSync(appearancePath, `${JSON.stringify(appearance, null, 2)}\n`, 'utf-8')
  console.log(`Synced appearance to theme "${id}": ${appearancePath}`)
}

/** Sync current appearance into the active theme's appearance.json. */
export function writeActiveThemeAppearance(config: AppearanceConfig): boolean {
  const themeRoot = getThemeFolderPath()
  const themeConfig = readThemeConfig(themeRoot)
  const activeId = themeConfig?.activeTheme?.trim() || ''
  if (!activeId || !themeConfig?.themes[activeId]) {
    console.warn('Skip theme appearance sync: active theme unavailable', {
      themeRoot,
      activeId
    })
    return false
  }

  try {
    writeThemeAppearance(activeId, config)
    return true
  } catch (error) {
    console.warn('Failed to write active theme appearance:', error)
    return false
  }
}

export function setActiveTheme(themeId: string): {
  config: ThemeConfig
  appearance: unknown | null
} {
  const id = themeId.trim()
  const folder = getThemeFolderPath()
  const config = readThemeConfig(folder)
  if (!config || !config.themes[id]) {
    throw new Error(`Theme not found: ${id}`)
  }

  const next: ThemeConfig = {
    ...config,
    activeTheme: id
  }
  writeThemeConfig(next, folder)

  return {
    config: next,
    appearance: readThemeAppearance(id)
  }
}

function readMeta(folder: string): CharacterMeta | null {
  const metaPath = join(folder, 'meta.json')
  if (!existsSync(metaPath)) return null

  try {
    return normalizeCharacterMeta(readJsonFile(metaPath))
  } catch (error) {
    console.warn('Failed to load character meta:', error)
    return null
  }
}

export function resolveActiveThemeAsset(fileName: string): string | null {
  const trimmed = fileName.trim().replace(/^\/+/, '')
  if (!trimmed || trimmed.includes('..') || trimmed.includes('\\')) return null

  const themeFolder = getActiveThemeFolder()
  if (!themeFolder || !existsSync(themeFolder)) return null

  const meta = readMeta(themeFolder)
  if (!meta) return null

  const allowed = new Set([meta.files.base, meta.files.character, meta.files.alpha])
  if (!allowed.has(trimmed)) return null

  const filePath = join(themeFolder, trimmed)
  return existsSync(filePath) ? filePath : null
}

export function getActiveCharacterPackUrls(): CharacterPackUrls | null {
  const themeFolder = getActiveThemeFolder()
  if (!themeFolder || !existsSync(themeFolder)) {
    console.warn('Active theme folder missing:', themeFolder)
    return null
  }

  const meta = readMeta(themeFolder)
  if (!meta) {
    console.warn('Character meta missing in theme folder:', themeFolder)
    return null
  }

  for (const fileName of [meta.files.base, meta.files.character, meta.files.alpha]) {
    if (!existsSync(join(themeFolder, fileName))) {
      console.warn('Character asset missing:', join(themeFolder, fileName))
      return null
    }
  }

  const stamp = Date.now()
  return {
    meta,
    baseUrl: `pettheme://pack/${meta.files.base}?t=${stamp}`,
    characterUrl: `pettheme://pack/${meta.files.character}?t=${stamp}`,
    alphaUrl: `pettheme://pack/${meta.files.alpha}?t=${stamp}`
  }
}
