import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { join, normalize, resolve } from 'path'
import { normalizeAppearanceConfig, type AppearanceConfig } from '../shared/appearance'
import {
  THEME_ID_PATTERN,
  type CreateThemePayload,
  type CreateThemeResult,
  type DeleteThemeResult,
  type ThemeConfig,
  type ThemeDetail
} from '../shared/theme'
import {
  hasOpaquePixels,
  readPngInfo,
  writeAlphaBin,
  writeCharacterMeta
} from './characterAlpha'
import { getThemeFolderPath } from './systemConfig'

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function getThemeConfigPath(folder = getThemeFolderPath()): string {
  return join(folder, 'theme.json')
}

function loadThemeConfig(folder = getThemeFolderPath()): ThemeConfig {
  const path = getThemeConfigPath(folder)
  if (!existsSync(path)) {
    throw new Error('主题配置写入失败')
  }

  const parsed = readJsonFile(path) as ThemeConfig
  if (!parsed || typeof parsed !== 'object' || !parsed.themes) {
    throw new Error('主题配置写入失败')
  }
  return {
    activeTheme: String(parsed.activeTheme ?? ''),
    themes: { ...parsed.themes }
  }
}

function writeThemeConfig(config: ThemeConfig, folder = getThemeFolderPath()): void {
  writeFileSync(getThemeConfigPath(folder), `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
}

function samePath(a: string, b: string): boolean {
  return normalize(resolve(a)).toLowerCase() === normalize(resolve(b)).toLowerCase()
}

function removeDirSafe(path: string): void {
  if (!existsSync(path)) return
  rmSync(path, { recursive: true, force: true })
}

export function createTheme(payload: CreateThemePayload): CreateThemeResult {
  const id = String(payload?.id ?? '').trim()
  const label = String(payload?.label ?? '').trim()
  const basePath = String(payload?.basePath ?? '').trim()
  const characterPath = String(payload?.characterPath ?? '').trim()
  const appearance = normalizeAppearanceConfig(payload?.appearance)

  if (!label) throw new Error('请输入主题名称')
  if (label.length > 20) throw new Error('主题名称不能超过 20 个字符')
  if (!id) throw new Error('请输入目录 ID')
  if (!THEME_ID_PATTERN.test(id)) {
    throw new Error('目录 ID 只能包含小写字母、数字和连字符')
  }
  if (!basePath) throw new Error('请选择原图')
  if (!characterPath) throw new Error('请选择单个角色图')
  if (!existsSync(basePath)) throw new Error('原图文件不存在')
  if (!existsSync(characterPath)) throw new Error('单个角色图文件不存在')
  if (samePath(basePath, characterPath)) {
    throw new Error('原图和单个角色图不能是同一个文件')
  }

  const themeRoot = getThemeFolderPath()
  const config = loadThemeConfig(themeRoot)

  if (config.themes[id]) {
    throw new Error('主题 ID 已存在')
  }

  const labelTaken = Object.values(config.themes).some(
    (entry) => entry.label.trim().toLowerCase() === label.toLowerCase()
  )
  if (labelTaken) {
    throw new Error('主题名称已存在')
  }

  const targetFolder = join(themeRoot, 'themes', id)
  if (existsSync(targetFolder)) {
    throw new Error('目标主题文件夹已存在')
  }

  let baseInfo
  let characterInfo
  try {
    baseInfo = readPngInfo(basePath)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '原图不是有效的 PNG 图片')
  }
  try {
    characterInfo = readPngInfo(characterPath)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '单个角色图不是有效的 PNG 图片')
  }

  if (baseInfo.width !== characterInfo.width || baseInfo.height !== characterInfo.height) {
    throw new Error('两张图片尺寸必须一致')
  }
  if (!hasOpaquePixels(characterInfo.alphaMap)) {
    throw new Error('单个角色图没有可点击的不透明像素')
  }

  const tempFolder = join(
    themeRoot,
    'themes',
    `.importing-${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  )

  mkdirSync(join(themeRoot, 'themes'), { recursive: true })
  mkdirSync(tempFolder, { recursive: true })

  try {
    copyFileSync(basePath, join(tempFolder, 'base.png'))
    copyFileSync(characterPath, join(tempFolder, 'character.png'))
    writeFileSync(
      join(tempFolder, 'appearance.json'),
      `${JSON.stringify(appearance, null, 2)}\n`,
      'utf-8'
    )
    writeAlphaBin(
      join(tempFolder, 'alpha.bin'),
      characterInfo.width,
      characterInfo.height,
      characterInfo.alphaMap
    )
    writeCharacterMeta(join(tempFolder, 'meta.json'), id, characterInfo.width, characterInfo.height)

    if (existsSync(targetFolder)) {
      throw new Error('目标主题文件夹已存在')
    }

    renameSync(tempFolder, targetFolder)

    const nextConfig: ThemeConfig = {
      ...config,
      themes: {
        ...config.themes,
        [id]: {
          label,
          folder: `themes/${id}`
        }
      }
    }

    try {
      writeThemeConfig(nextConfig, themeRoot)
    } catch {
      removeDirSafe(targetFolder)
      throw new Error('主题配置写入失败')
    }

    return {
      theme: { id, label },
      config: nextConfig
    }
  } catch (error) {
    removeDirSafe(tempFolder)
    throw error
  }
}

export function getThemeDetail(themeId: string): ThemeDetail {
  const id = String(themeId ?? '').trim()
  if (!id) throw new Error('主题不存在')

  const themeRoot = getThemeFolderPath()
  const config = loadThemeConfig(themeRoot)
  const entry = config.themes[id]
  if (!entry) throw new Error('主题不存在')

  const folder = join(themeRoot, entry.folder)
  const basePath = join(folder, 'base.png')
  const characterPath = join(folder, 'character.png')
  const appearancePath = join(folder, 'appearance.json')

  if (!existsSync(basePath)) throw new Error('原图文件不存在')
  if (!existsSync(characterPath)) throw new Error('单个角色图文件不存在')

  let appearance: AppearanceConfig
  if (existsSync(appearancePath)) {
    try {
      appearance = normalizeAppearanceConfig(readJsonFile(appearancePath))
    } catch {
      appearance = normalizeAppearanceConfig({})
    }
  } else {
    appearance = normalizeAppearanceConfig({})
  }

  return {
    id,
    label: entry.label,
    basePath,
    characterPath,
    appearance
  }
}

function copyIfDifferent(source: string, target: string): void {
  if (samePath(source, target)) return
  copyFileSync(source, target)
}

export function updateTheme(payload: CreateThemePayload): CreateThemeResult {
  const id = String(payload?.id ?? '').trim()
  const label = String(payload?.label ?? '').trim()
  const basePath = String(payload?.basePath ?? '').trim()
  const characterPath = String(payload?.characterPath ?? '').trim()
  const appearance = normalizeAppearanceConfig(payload?.appearance)

  if (!label) throw new Error('请输入主题名称')
  if (label.length > 20) throw new Error('主题名称不能超过 20 个字符')
  if (!id) throw new Error('请输入目录 ID')
  if (!THEME_ID_PATTERN.test(id)) {
    throw new Error('目录 ID 只能包含小写字母、数字和连字符')
  }
  if (!basePath) throw new Error('请选择原图')
  if (!characterPath) throw new Error('请选择单个角色图')
  if (!existsSync(basePath)) throw new Error('原图文件不存在')
  if (!existsSync(characterPath)) throw new Error('单个角色图文件不存在')
  if (samePath(basePath, characterPath)) {
    throw new Error('原图和单个角色图不能是同一个文件')
  }

  const themeRoot = getThemeFolderPath()
  const config = loadThemeConfig(themeRoot)
  const entry = config.themes[id]
  if (!entry) throw new Error('主题不存在')

  const labelTaken = Object.entries(config.themes).some(
    ([themeKey, item]) =>
      themeKey !== id && item.label.trim().toLowerCase() === label.toLowerCase()
  )
  if (labelTaken) {
    throw new Error('主题名称已存在')
  }

  const targetFolder = join(themeRoot, entry.folder)
  if (!existsSync(targetFolder)) {
    throw new Error('目标主题文件夹不存在')
  }

  let baseInfo
  let characterInfo
  try {
    baseInfo = readPngInfo(basePath)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '原图不是有效的 PNG 图片')
  }
  try {
    characterInfo = readPngInfo(characterPath)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '单个角色图不是有效的 PNG 图片')
  }

  if (baseInfo.width !== characterInfo.width || baseInfo.height !== characterInfo.height) {
    throw new Error('两张图片尺寸必须一致')
  }
  if (!hasOpaquePixels(characterInfo.alphaMap)) {
    throw new Error('单个角色图没有可点击的不透明像素')
  }

  const targetBase = join(targetFolder, 'base.png')
  const targetCharacter = join(targetFolder, 'character.png')
  const tempFolder = join(
    themeRoot,
    'themes',
    `.editing-${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  )

  mkdirSync(tempFolder, { recursive: true })

  try {
    copyFileSync(basePath, join(tempFolder, 'base.png'))
    copyFileSync(characterPath, join(tempFolder, 'character.png'))
    writeFileSync(
      join(tempFolder, 'appearance.json'),
      `${JSON.stringify(appearance, null, 2)}\n`,
      'utf-8'
    )
    writeAlphaBin(
      join(tempFolder, 'alpha.bin'),
      characterInfo.width,
      characterInfo.height,
      characterInfo.alphaMap
    )
    writeCharacterMeta(join(tempFolder, 'meta.json'), id, characterInfo.width, characterInfo.height)

    copyIfDifferent(join(tempFolder, 'base.png'), targetBase)
    copyIfDifferent(join(tempFolder, 'character.png'), targetCharacter)
    copyFileSync(join(tempFolder, 'appearance.json'), join(targetFolder, 'appearance.json'))
    copyFileSync(join(tempFolder, 'alpha.bin'), join(targetFolder, 'alpha.bin'))
    copyFileSync(join(tempFolder, 'meta.json'), join(targetFolder, 'meta.json'))
    removeDirSafe(tempFolder)

    const nextConfig: ThemeConfig = {
      ...config,
      themes: {
        ...config.themes,
        [id]: {
          ...entry,
          label
        }
      }
    }

    try {
      writeThemeConfig(nextConfig, themeRoot)
    } catch {
      throw new Error('主题配置写入失败')
    }

    return {
      theme: { id, label },
      config: nextConfig
    }
  } catch (error) {
    removeDirSafe(tempFolder)
    throw error
  }
}

export function deleteTheme(themeId: string): DeleteThemeResult {
  const id = String(themeId ?? '').trim()
  if (!id) throw new Error('主题不存在')

  const themeRoot = getThemeFolderPath()
  const config = loadThemeConfig(themeRoot)
  const entry = config.themes[id]
  if (!entry) throw new Error('主题不存在')

  const themeIds = Object.keys(config.themes)
  if (themeIds.length <= 1) {
    throw new Error('至少保留一个主题')
  }

  const nextThemes = { ...config.themes }
  delete nextThemes[id]

  const wasActive = config.activeTheme === id
  let nextActive = config.activeTheme
  if (wasActive) {
    nextActive = Object.keys(nextThemes)[0] ?? ''
    if (!nextActive || !nextThemes[nextActive]) {
      throw new Error('至少保留一个主题')
    }
  }

  const nextConfig: ThemeConfig = {
    activeTheme: nextActive,
    themes: nextThemes
  }

  try {
    writeThemeConfig(nextConfig, themeRoot)
  } catch {
    throw new Error('主题配置写入失败')
  }

  const targetFolder = join(themeRoot, entry.folder)
  removeDirSafe(targetFolder)

  let appearance: AppearanceConfig | null = null
  if (wasActive) {
    const appearancePath = join(themeRoot, nextThemes[nextActive].folder, 'appearance.json')
    if (existsSync(appearancePath)) {
      try {
        appearance = normalizeAppearanceConfig(readJsonFile(appearancePath))
      } catch {
        appearance = normalizeAppearanceConfig({})
      }
    } else {
      appearance = normalizeAppearanceConfig({})
    }
  }

  return {
    deletedId: id,
    config: nextConfig,
    appearance,
    switched: wasActive
  }
}
