import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, join, relative } from 'path'
import { getSoundFolderPath } from './systemConfig'
import type { AudioEntry } from '../shared/audio'

const DEFAULT_CLICK_NAME = '橡皮鸭'
const DEFAULT_CLICK_RELATIVE = 'sounds/橡皮鸭.mp3'

function getAudioConfigPath(folder = getSoundFolderPath()): string {
  return join(folder, 'audio.json')
}

function normalizeEntry(raw: unknown): AudioEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  const path = typeof item.path === 'string' ? item.path.trim() : ''
  if (!name || !path) return null
  return { name, path }
}

export function readAudioEntries(folder = getSoundFolderPath()): AudioEntry[] {
  const configPath = getAudioConfigPath(folder)
  if (!existsSync(configPath)) return []

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeEntry).filter((item): item is AudioEntry => item !== null)
  } catch (error) {
    console.warn('Failed to load audio config:', error)
    return []
  }
}

function writeAudioEntries(entries: AudioEntry[], folder = getSoundFolderPath()): AudioEntry[] {
  const configPath = getAudioConfigPath(folder)
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8')
  return entries.map((item) => ({ ...item }))
}

export function toStoredSoundPath(filePath: string, folder = getSoundFolderPath()): string {
  const trimmed = filePath.trim()
  if (!trimmed) return ''

  if (!isAbsolute(trimmed)) {
    return trimmed.replace(/\\/g, '/')
  }

  const rel = relative(folder, trimmed)
  if (!rel.startsWith('..') && !isAbsolute(rel)) {
    return rel.replace(/\\/g, '/')
  }

  return trimmed
}

export function resolveSoundFilePath(
  storedPath: string,
  folder = getSoundFolderPath()
): string | null {
  const trimmed = storedPath.trim()
  if (!trimmed) return null

  const candidates = isAbsolute(trimmed)
    ? [trimmed]
    : [join(folder, trimmed), join(folder, trimmed.replace(/\//g, '\\'))]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return null
}

export function addAudioEntry(entry: { name: string; path: string }): AudioEntry[] {
  const folder = getSoundFolderPath()
  const name = entry.name.trim()
  const path = toStoredSoundPath(entry.path, folder)
  if (!name || !path) {
    throw new Error('Invalid audio entry')
  }

  const entries = readAudioEntries(folder)
  if (entries.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Audio name already exists')
  }

  return writeAudioEntries([...entries, { name, path }], folder)
}

export function updateAudioEntry(
  oldName: string,
  entry: { name: string; path: string }
): AudioEntry[] {
  const folder = getSoundFolderPath()
  const nextName = entry.name.trim()
  const nextPath = toStoredSoundPath(entry.path, folder)
  if (!nextName || !nextPath) {
    throw new Error('Invalid audio entry')
  }

  const entries = readAudioEntries(folder)
  const index = entries.findIndex((item) => item.name === oldName)
  if (index < 0) {
    throw new Error('Audio entry not found')
  }

  if (
    entries.some(
      (item, i) => i !== index && item.name.toLowerCase() === nextName.toLowerCase()
    )
  ) {
    throw new Error('Audio name already exists')
  }

  const next = [...entries]
  next[index] = { name: nextName, path: nextPath }
  return writeAudioEntries(next, folder)
}

export function deleteAudioEntry(name: string): AudioEntry[] {
  const folder = getSoundFolderPath()
  const target = name.trim()
  if (!target) {
    throw new Error('Invalid audio name')
  }

  const entries = readAudioEntries(folder)
  const next = entries.filter((item) => item.name !== target)
  if (next.length === entries.length) {
    throw new Error('Audio entry not found')
  }

  return writeAudioEntries(next, folder)
}

export function resolveClickSoundPath(preferredName = DEFAULT_CLICK_NAME): string | null {
  const folder = getSoundFolderPath()
  const entries = readAudioEntries(folder)
  const preferred =
    entries.find((item) => item.name === preferredName) ?? entries[0] ?? null
  const relative = preferred?.path || DEFAULT_CLICK_RELATIVE
  const fullPath = resolveSoundFilePath(relative, folder)

  if (fullPath) return fullPath

  return resolveSoundFilePath(DEFAULT_CLICK_RELATIVE, folder)
}

export function readClickSoundBuffer(preferredName?: string): ArrayBuffer | null {
  const path = resolveClickSoundPath(preferredName)
  if (!path) {
    console.warn('Click sound file not found')
    return null
  }

  try {
    const buffer = readFileSync(path)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  } catch (error) {
    console.warn('Failed to read click sound:', error)
    return null
  }
}
