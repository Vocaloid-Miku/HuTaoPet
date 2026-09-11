export interface SystemConfig {
  autoStart: boolean
  appearanceConfigPath: string
  soundFolderPath: string
  soundConfigPath: string
  themeFolderPath: string
}

export const DEFAULT_SYSTEM: SystemConfig = {
  autoStart: false,
  appearanceConfigPath: '',
  soundFolderPath: '',
  soundConfigPath: '',
  themeFolderPath: ''
}

export function normalizeSystemConfig(input: unknown): SystemConfig {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<SystemConfig>

  return {
    autoStart:
      typeof source.autoStart === 'boolean' ? source.autoStart : DEFAULT_SYSTEM.autoStart,
    appearanceConfigPath:
      typeof source.appearanceConfigPath === 'string'
        ? source.appearanceConfigPath.trim()
        : DEFAULT_SYSTEM.appearanceConfigPath,
    soundFolderPath:
      typeof source.soundFolderPath === 'string'
        ? source.soundFolderPath.trim()
        : DEFAULT_SYSTEM.soundFolderPath,
    soundConfigPath:
      typeof source.soundConfigPath === 'string'
        ? source.soundConfigPath.trim()
        : DEFAULT_SYSTEM.soundConfigPath,
    themeFolderPath:
      typeof source.themeFolderPath === 'string'
        ? source.themeFolderPath.trim()
        : DEFAULT_SYSTEM.themeFolderPath
  }
}
