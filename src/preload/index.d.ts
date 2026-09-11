import { ElectronAPI } from '@electron-toolkit/preload'
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

export interface PetAPI {
  setIgnoreMouseEvents: (ignore: boolean, forward?: boolean) => void
  startCursorTracking: () => void
  stopCursorTracking: () => void
  toggleModal: () => void
  openModal: () => void
  closeModal: () => void
  minimizeModal: () => void
  getAppearanceConfig: () => Promise<AppearanceConfig>
  getSavedAppearanceConfig: () => Promise<AppearanceConfig>
  getAppearanceConfigPath: () => Promise<string>
  setAppearanceConfigPath: (path: string) => Promise<string>
  pickAppearanceConfigFile: () => Promise<string | null>
  getDefaultAppearanceConfig: () => Promise<AppearanceConfig>
  setAppearanceConfig: (
    partial: Partial<AppearanceConfig>,
    generation?: number
  ) => Promise<AppearanceConfig>
  saveAppearanceConfig: (config?: AppearanceConfig) => Promise<AppearanceConfig>
  resetAppearanceConfig: () => Promise<AppearanceConfig>
  restoreDefaultAppearanceConfig: () => Promise<AppearanceConfig>
  restoreAppearanceFromActiveTheme: () => Promise<AppearanceConfig>
  applyAppearanceToActiveTheme: (config: AppearanceConfig) => Promise<AppearanceConfig>
  getAppearanceGeneration: () => Promise<number>
  getSystemConfig: () => Promise<SystemConfig>
  getSavedSystemConfig: () => Promise<SystemConfig>
  getSystemConfigPath: () => Promise<string>
  getDefaultSystemConfig: () => Promise<SystemConfig>
  saveSystemConfig: (config: SystemConfig) => Promise<SystemConfig>
  setAutoStart: (enabled: boolean) => Promise<SystemConfig>
  resetSystemConfig: () => Promise<SystemConfig>
  restoreDefaultSystemConfig: () => Promise<SystemConfig>
  getSoundFolderPath: () => Promise<string>
  getClickSoundBuffer: () => Promise<ArrayBuffer | null>
  getAudioEntries: () => Promise<AudioEntry[]>
  addAudioEntry: (entry: { name: string; path: string }) => Promise<AudioEntry[]>
  updateAudioEntry: (payload: {
    oldName: string
    name: string
    path: string
  }) => Promise<AudioEntry[]>
  deleteAudioEntry: (name: string) => Promise<AudioEntry[]>
  getAudioSettings: () => Promise<AudioSettings>
  getAudioSettingsPath: () => Promise<string>
  setAudioSettingsPath: (path: string) => Promise<string>
  pickSoundConfigFile: () => Promise<string | null>
  setClickSoundName: (name: string) => Promise<AudioSettings>
  setSoundEnabled: (enabled: boolean) => Promise<AudioSettings>
  setSoundVolume: (volume: number) => Promise<AudioSettings>
  setSoundSettings: (settings: {
    soundEnabled: boolean
    soundVolume: number
  }) => Promise<AudioSettings>
  getThemeFolderPath: () => Promise<string>
  getThemeConfig: () => Promise<ThemeConfig | null>
  getThemeOptions: () => Promise<ThemeOption[]>
  getThemeDefaultAppearance: () => Promise<AppearanceConfig>
  getActiveThemeId: () => Promise<string | null>
  setActiveTheme: (
    themeId: string
  ) => Promise<{ config: ThemeConfig; appearance: AppearanceConfig }>
  getActiveCharacterPack: () => Promise<CharacterPackUrls | null>
  setSoundFolderPath: (path: string) => Promise<string>
  setThemeFolderPath: (path: string) => Promise<string>
  pickSoundFolder: () => Promise<string | null>
  pickSoundFile: () => Promise<string | null>
  pickThemeFolder: () => Promise<string | null>
  pickThemeImage: () => Promise<string | null>
  createTheme: (payload: CreateThemePayload) => Promise<CreateThemeResult>
  getThemeDetail: (themeId: string) => Promise<ThemeDetail>
  updateTheme: (payload: CreateThemePayload) => Promise<CreateThemeResult>
  deleteTheme: (themeId: string) => Promise<DeleteThemeResult>
  openExternalUrl: (url: string) => Promise<boolean>
  onCursorPosition: (callback: (pos: { x: number; y: number }) => void) => () => void
  onAppearanceConfigChanged: (
    callback: (config: AppearanceConfig, generation?: number) => void
  ) => () => void
  onSystemConfigChanged: (callback: (config: SystemConfig) => void) => () => void
  onAudioSettingsChanged: (callback: (config: AudioSettings) => void) => () => void
  onThemeChanged: (callback: (config: ThemeConfig) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: PetAPI
  }
}
