export interface AudioSettings {
  soundEnabled: boolean
  soundVolume: number
  clickSoundName: string
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  soundEnabled: true,
  soundVolume: 5,
  clickSoundName: '橡皮鸭'
}

function clampSoundVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_AUDIO_SETTINGS.soundVolume
  }
  return Math.min(10, Math.max(0, Math.round(value)))
}

export function normalizeAudioSettings(input: unknown): AudioSettings {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<AudioSettings>

  return {
    soundEnabled:
      typeof source.soundEnabled === 'boolean'
        ? source.soundEnabled
        : DEFAULT_AUDIO_SETTINGS.soundEnabled,
    soundVolume: clampSoundVolume(source.soundVolume),
    clickSoundName:
      typeof source.clickSoundName === 'string'
        ? source.clickSoundName.trim()
        : DEFAULT_AUDIO_SETTINGS.clickSoundName
  }
}
