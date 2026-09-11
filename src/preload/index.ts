import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppearanceConfig } from '../shared/appearance'
import type { AudioEntry } from '../shared/audio'
import type { AudioSettings } from '../shared/audioSettings'
import type { CharacterPackUrls } from '../shared/character'
import type { SystemConfig } from '../shared/system'
import type {
  ThemeConfig,
  ThemeOption,
  ThemeDetail,
  CreateThemePayload,
  CreateThemeResult,
  DeleteThemeResult
} from '../shared/theme'

const api = {
  setIgnoreMouseEvents: (ignore: boolean, forward = false): void => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, forward)
  },
  startCursorTracking: (): void => {
    ipcRenderer.send('start-cursor-tracking')
  },
  stopCursorTracking: (): void => {
    ipcRenderer.send('stop-cursor-tracking')
  },
  toggleModal: (): void => {
    ipcRenderer.send('toggle-modal')
  },
  openModal: (): void => {
    ipcRenderer.send('open-modal')
  },
  closeModal: (): void => {
    ipcRenderer.send('close-modal')
  },
  minimizeModal: (): void => {
    ipcRenderer.send('minimize-modal')
  },
  getAppearanceConfig: (): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('get-appearance-config')
  },
  getSavedAppearanceConfig: (): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('get-saved-appearance-config')
  },
  getAppearanceConfigPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-appearance-config-path')
  },
  setAppearanceConfigPath: (path: string): Promise<string> => {
    return ipcRenderer.invoke('set-appearance-config-path', path)
  },
  pickAppearanceConfigFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-appearance-config-file')
  },
  getDefaultAppearanceConfig: (): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('get-default-appearance-config')
  },
  setAppearanceConfig: (
    partial: Partial<AppearanceConfig>,
    generation?: number
  ): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('set-appearance-config', partial, generation)
  },
  saveAppearanceConfig: (config?: AppearanceConfig): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('save-appearance-config', config)
  },
  resetAppearanceConfig: (): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('reset-appearance-config')
  },
  restoreDefaultAppearanceConfig: (): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('restore-default-appearance-config')
  },
  restoreAppearanceFromActiveTheme: (): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('restore-appearance-from-active-theme')
  },
  applyAppearanceToActiveTheme: (config: AppearanceConfig): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('apply-appearance-to-active-theme', config)
  },
  getAppearanceGeneration: (): Promise<number> => {
    return ipcRenderer.invoke('get-appearance-generation')
  },
  getSystemConfig: (): Promise<SystemConfig> => {
    return ipcRenderer.invoke('get-system-config')
  },
  getSavedSystemConfig: (): Promise<SystemConfig> => {
    return ipcRenderer.invoke('get-saved-system-config')
  },
  getSystemConfigPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-system-config-path')
  },
  getDefaultSystemConfig: (): Promise<SystemConfig> => {
    return ipcRenderer.invoke('get-default-system-config')
  },
  saveSystemConfig: (config: SystemConfig): Promise<SystemConfig> => {
    return ipcRenderer.invoke('save-system-config', config)
  },
  setAutoStart: (enabled: boolean): Promise<SystemConfig> => {
    return ipcRenderer.invoke('set-auto-start', enabled)
  },
  resetSystemConfig: (): Promise<SystemConfig> => {
    return ipcRenderer.invoke('reset-system-config')
  },
  restoreDefaultSystemConfig: (): Promise<SystemConfig> => {
    return ipcRenderer.invoke('restore-default-system-config')
  },
  getSoundFolderPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-sound-folder-path')
  },
  getClickSoundBuffer: (): Promise<ArrayBuffer | null> => {
    return ipcRenderer.invoke('get-click-sound-buffer')
  },
  getAudioEntries: (): Promise<AudioEntry[]> => {
    return ipcRenderer.invoke('get-audio-entries')
  },
  addAudioEntry: (entry: { name: string; path: string }): Promise<AudioEntry[]> => {
    return ipcRenderer.invoke('add-audio-entry', entry)
  },
  updateAudioEntry: (payload: {
    oldName: string
    name: string
    path: string
  }): Promise<AudioEntry[]> => {
    return ipcRenderer.invoke('update-audio-entry', payload)
  },
  deleteAudioEntry: (name: string): Promise<AudioEntry[]> => {
    return ipcRenderer.invoke('delete-audio-entry', name)
  },
  getAudioSettings: (): Promise<AudioSettings> => {
    return ipcRenderer.invoke('get-audio-settings')
  },
  getAudioSettingsPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-audio-settings-path')
  },
  setAudioSettingsPath: (path: string): Promise<string> => {
    return ipcRenderer.invoke('set-audio-settings-path', path)
  },
  pickSoundConfigFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-sound-config-file')
  },
  setClickSoundName: (name: string): Promise<AudioSettings> => {
    return ipcRenderer.invoke('set-click-sound-name', name)
  },
  setSoundEnabled: (enabled: boolean): Promise<AudioSettings> => {
    return ipcRenderer.invoke('set-sound-enabled', enabled)
  },
  setSoundVolume: (volume: number): Promise<AudioSettings> => {
    return ipcRenderer.invoke('set-sound-volume', volume)
  },
  setSoundSettings: (settings: {
    soundEnabled: boolean
    soundVolume: number
  }): Promise<AudioSettings> => {
    return ipcRenderer.invoke('set-sound-settings', settings)
  },
  getThemeFolderPath: (): Promise<string> => {
    return ipcRenderer.invoke('get-theme-folder-path')
  },
  getThemeConfig: (): Promise<ThemeConfig | null> => {
    return ipcRenderer.invoke('get-theme-config')
  },
  getThemeOptions: (): Promise<ThemeOption[]> => {
    return ipcRenderer.invoke('get-theme-options')
  },
  getThemeDefaultAppearance: (): Promise<AppearanceConfig> => {
    return ipcRenderer.invoke('get-theme-default-appearance')
  },
  getActiveThemeId: (): Promise<string | null> => {
    return ipcRenderer.invoke('get-active-theme-id')
  },
  setActiveTheme: (
    themeId: string
  ): Promise<{ config: ThemeConfig; appearance: AppearanceConfig }> => {
    return ipcRenderer.invoke('set-active-theme', themeId)
  },
  getActiveCharacterPack: (): Promise<CharacterPackUrls | null> => {
    return ipcRenderer.invoke('get-active-character-pack')
  },
  setSoundFolderPath: (path: string): Promise<string> => {
    return ipcRenderer.invoke('set-sound-folder-path', path)
  },
  setThemeFolderPath: (path: string): Promise<string> => {
    return ipcRenderer.invoke('set-theme-folder-path', path)
  },
  pickSoundFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-sound-folder')
  },
  pickSoundFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-sound-file')
  },
  pickThemeFolder: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-theme-folder')
  },
  pickThemeImage: (): Promise<string | null> => {
    return ipcRenderer.invoke('pick-theme-image')
  },
  createTheme: (payload: CreateThemePayload): Promise<CreateThemeResult> => {
    return ipcRenderer.invoke('create-theme', payload)
  },
  getThemeDetail: (themeId: string): Promise<ThemeDetail> => {
    return ipcRenderer.invoke('get-theme-detail', themeId)
  },
  updateTheme: (payload: CreateThemePayload): Promise<CreateThemeResult> => {
    return ipcRenderer.invoke('update-theme', payload)
  },
  deleteTheme: (themeId: string): Promise<DeleteThemeResult> => {
    return ipcRenderer.invoke('delete-theme', themeId)
  },
  openExternalUrl: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-external-url', url)
  },
  onCursorPosition: (callback: (pos: { x: number; y: number }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, pos: { x: number; y: number }): void => {
      callback(pos)
    }

    ipcRenderer.on('cursor-position', handler)

    return () => {
      ipcRenderer.removeListener('cursor-position', handler)
    }
  },
  onAppearanceConfigChanged: (
    callback: (config: AppearanceConfig, generation?: number) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      config: AppearanceConfig,
      generation?: number
    ): void => {
      callback(config, generation)
    }

    ipcRenderer.on('appearance-config-changed', handler)

    return () => {
      ipcRenderer.removeListener('appearance-config-changed', handler)
    }
  },
  onSystemConfigChanged: (callback: (config: SystemConfig) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: SystemConfig): void => {
      callback(config)
    }

    ipcRenderer.on('system-config-changed', handler)

    return () => {
      ipcRenderer.removeListener('system-config-changed', handler)
    }
  },
  onAudioSettingsChanged: (callback: (config: AudioSettings) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: AudioSettings): void => {
      callback(config)
    }

    ipcRenderer.on('audio-settings-changed', handler)

    return () => {
      ipcRenderer.removeListener('audio-settings-changed', handler)
    }
  },
  onThemeChanged: (callback: (config: ThemeConfig) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: ThemeConfig): void => {
      callback(config)
    }

    ipcRenderer.on('theme-changed', handler)

    return () => {
      ipcRenderer.removeListener('theme-changed', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
