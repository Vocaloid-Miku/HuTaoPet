import { BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  DEFAULT_AUDIO_SETTINGS,
  normalizeAudioSettings,
  type AudioSettings
} from '../shared/audioSettings'
import { getSoundConfigPath, updateSoundConfigPath } from './systemConfig'

let currentAudioSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }
let savedAudioSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }

function getBundledDefaultPath(): string {
  if (is.dev) {
    return join(process.cwd(), 'config', 'audio-settings.json')
  }
  return join(process.resourcesPath, 'config', 'audio-settings.json')
}

function getActiveSettingsPath(): string {
  return getSoundConfigPath()
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function broadcastAudioSettings(config: AudioSettings): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('audio-settings-changed', config)
    }
  }
}

export function loadDefaultAudioSettings(): AudioSettings {
  try {
    const path = getBundledDefaultPath()
    if (existsSync(path)) {
      return normalizeAudioSettings(readJsonFile(path))
    }
  } catch (error) {
    console.warn('Failed to load default audio settings:', error)
  }
  return { ...DEFAULT_AUDIO_SETTINGS }
}

function loadSavedAudioSettings(): AudioSettings | null {
  const path = getActiveSettingsPath()
  if (!existsSync(path)) return null

  try {
    return normalizeAudioSettings(readJsonFile(path))
  } catch (error) {
    console.warn('Failed to load audio settings:', error)
    return null
  }
}

function saveAudioSettingsToFile(config: AudioSettings): void {
  const path = getActiveSettingsPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
}

export function initializeAudioSettings(): AudioSettings {
  const defaults = loadDefaultAudioSettings()
  const saved = loadSavedAudioSettings()
  currentAudioSettings = saved ?? defaults
  savedAudioSettings = { ...currentAudioSettings }

  if (!saved) {
    saveAudioSettingsToFile(currentAudioSettings)
  }

  broadcastAudioSettings(currentAudioSettings)
  return currentAudioSettings
}

export function getAudioSettings(): AudioSettings {
  return { ...currentAudioSettings }
}

export function getSavedAudioSettings(): AudioSettings {
  return { ...savedAudioSettings }
}

export function getAudioSettingsPath(): string {
  return getActiveSettingsPath()
}

export function setAudioSettingsPath(path: string): string {
  updateSoundConfigPath(path)
  initializeAudioSettings()
  return getAudioSettingsPath()
}

export function saveAudioSettings(config: AudioSettings): AudioSettings {
  const next = normalizeAudioSettings(config)
  currentAudioSettings = next
  savedAudioSettings = { ...next }
  saveAudioSettingsToFile(next)
  broadcastAudioSettings(next)
  return next
}

export function updateAudioSettings(partial: Partial<AudioSettings>): AudioSettings {
  return saveAudioSettings({
    ...currentAudioSettings,
    ...partial
  })
}

export function updateSoundEnabled(enabled: boolean): AudioSettings {
  return updateAudioSettings({ soundEnabled: enabled })
}

export function updateSoundVolume(volume: number): AudioSettings {
  return updateAudioSettings({ soundVolume: volume })
}

export function updateClickSoundName(name: string): AudioSettings {
  return updateAudioSettings({ clickSoundName: name.trim() })
}

export function updateSoundPlaybackSettings(settings: {
  soundEnabled: boolean
  soundVolume: number
}): AudioSettings {
  return updateAudioSettings({
    soundEnabled: settings.soundEnabled,
    soundVolume: settings.soundVolume
  })
}
