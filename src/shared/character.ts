export interface CharacterMeta {
  id: string
  width: number
  height: number
  alphaThreshold: number
  files: {
    base: string
    character: string
    alpha: string
  }
}

export interface CharacterPackUrls {
  meta: CharacterMeta
  baseUrl: string
  characterUrl: string
  alphaUrl: string
}

export function normalizeCharacterMeta(input: unknown): CharacterMeta | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Record<string, unknown>
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const width = typeof source.width === 'number' ? source.width : 0
  const height = typeof source.height === 'number' ? source.height : 0
  const alphaThreshold =
    typeof source.alphaThreshold === 'number' ? source.alphaThreshold : 10
  const files =
    source.files && typeof source.files === 'object'
      ? (source.files as Record<string, unknown>)
      : null

  const base = typeof files?.base === 'string' ? files.base.trim() : 'base.png'
  const character =
    typeof files?.character === 'string' ? files.character.trim() : 'character.png'
  const alpha = typeof files?.alpha === 'string' ? files.alpha.trim() : 'alpha.bin'

  if (!id || width <= 0 || height <= 0) return null

  return {
    id,
    width,
    height,
    alphaThreshold,
    files: { base, character, alpha }
  }
}
