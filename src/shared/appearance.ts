export interface AppearanceConfig {
  petSize: number
  menuBtnSize: number
  menuBtnTop: number
  menuBtnRight: number
  menuBtnIconColor: string
  menuBtnBorderColor: string
  menuBtnBgColor: string
  speechVisible: boolean
  speechFontSize: number
  speechColor: string
  speechTexts: string[]
}

export const DEFAULT_SPEECH_TEXTS = ['好女孩', '胡桃桃', '要芙芙', '摸摸头'] as const

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  petSize: 210,
  menuBtnSize: 36,
  menuBtnTop: 14,
  menuBtnRight: 1,
  menuBtnIconColor: '#302220',
  menuBtnBorderColor: '#302220',
  menuBtnBgColor: '#6e4e4f',
  speechVisible: true,
  speechFontSize: 21,
  speechColor: '#6e4e4f',
  speechTexts: [...DEFAULT_SPEECH_TEXTS]
}

export const SPEECH_TEXT_MAX_LENGTH = 3
export const SPEECH_TEXTS_MAX_COUNT = 30

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeHex(color: unknown, fallback: string): string {
  if (typeof color !== 'string') return fallback
  const value = color.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase()
  if (/^#[0-9a-fA-F]{8}$/.test(value)) return value.slice(0, 7).toLowerCase()
  return fallback
}

export function countSpeechChars(text: string): number {
  return Array.from(text).length
}

export function normalizeSpeechTexts(input: unknown): string[] {
  const fallback = [...DEFAULT_APPEARANCE.speechTexts]
  if (!Array.isArray(input) || input.length === 0) return fallback

  const cleaned: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') continue
    cleaned.push(item)
    if (cleaned.length >= SPEECH_TEXTS_MAX_COUNT) break
  }

  return cleaned.length > 0 ? cleaned : fallback
}

/** Validate on save only. Returns error message, or null when valid. */
export function validateSpeechTextsForSave(input: unknown): string | null {
  if (!Array.isArray(input)) {
    return '文本内容格式无效'
  }
  if (input.length > SPEECH_TEXTS_MAX_COUNT) {
    return `文本内容最多 ${SPEECH_TEXTS_MAX_COUNT} 条`
  }

  let hasContent = false
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index]
    if (typeof item !== 'string') {
      return `第 ${index + 1} 条文本格式无效`
    }
    const text = item.trim()
    if (!text) continue
    hasContent = true
    if (countSpeechChars(text) > SPEECH_TEXT_MAX_LENGTH) {
      return `第 ${index + 1} 条文本不能超过 ${SPEECH_TEXT_MAX_LENGTH} 个字`
    }
  }

  if (!hasContent) {
    return '请至少填写一条文本'
  }

  return null
}

/** Persist only non-empty lines after save-time validation. */
export function sanitizeSpeechTextsForSave(input: unknown): string[] {
  const error = validateSpeechTextsForSave(input)
  if (error) {
    throw new Error(error)
  }

  const filled = (input as unknown[])
    .filter((item): item is string => typeof item === 'string')
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .slice(0, SPEECH_TEXTS_MAX_COUNT)

  return filled
}

export function cloneAppearanceConfig(config: AppearanceConfig): AppearanceConfig {
  return {
    ...config,
    speechTexts: [...config.speechTexts]
  }
}

export function normalizeAppearanceConfig(input: unknown): AppearanceConfig {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<AppearanceConfig>
  const base = DEFAULT_APPEARANCE

  return {
    petSize: clamp(Math.round((Number(source.petSize) || base.petSize) / 10) * 10, 180, 480),
    menuBtnSize: clamp(Math.round((Number(source.menuBtnSize) || base.menuBtnSize) / 2) * 2, 36, 54),
    menuBtnTop: clamp(Math.round(Number(source.menuBtnTop) || base.menuBtnTop), 10, 20),
    menuBtnRight: clamp(Math.round(Number(source.menuBtnRight) || base.menuBtnRight), 1, 10),
    menuBtnIconColor: normalizeHex(source.menuBtnIconColor, base.menuBtnIconColor),
    menuBtnBorderColor: normalizeHex(source.menuBtnBorderColor, base.menuBtnBorderColor),
    menuBtnBgColor: normalizeHex(source.menuBtnBgColor, base.menuBtnBgColor),
    speechVisible:
      typeof source.speechVisible === 'boolean' ? source.speechVisible : base.speechVisible,
    speechFontSize: clamp(Math.round(Number(source.speechFontSize) || base.speechFontSize), 18, 48),
    speechColor: normalizeHex(source.speechColor, base.speechColor),
    speechTexts: normalizeSpeechTexts(source.speechTexts)
  }
}
